import { NextApiRequest, NextApiResponse } from 'next';
import { verifyDownloadToken } from '../../lib/token';
import { isTrustedCDN } from '../../lib/urls';
import fetch from 'node-fetch';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Disable Next.js body parsing to handle streams
export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid download token' });
  }

  const payload = await verifyDownloadToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { url, quality, format } = payload;

  try {
    // Check if the URL is from a trusted CDN using secure domain validation
    const isTrusted = isTrustedCDN(url);

    if (!isTrusted) {
      return res.status(403).json({ error: 'Untrusted video source' });
    }

    // Parse URL to check hostname
    const urlObj = new URL(url);

    // For YouTube direct URLs, we can often redirect (saves bandwidth)
    if (urlObj.hostname.includes('googlevideo.com')) {
      // YouTube URLs typically work with direct redirect
      // Note: Content-Disposition header is ignored on redirects
      return res.redirect(302, url);
    }

    // For other sources or if redirect fails, proxy the stream
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Set appropriate headers
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Content-Disposition', `attachment; filename="video_${quality}.${format}"`);

    // Stream the video through our server with proper backpressure handling
    if (!response.body) {
      throw new Error('No response body');
    }

    // Convert Web Stream to Node.js stream and pipe with proper error handling
    const nodeStream = Readable.fromWeb(response.body as any);
    await pipeline(nodeStream, res);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Failed to download video' });
  }
}