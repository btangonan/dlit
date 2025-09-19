import { NextApiRequest, NextApiResponse } from 'next';
import { verifyDownloadToken } from '../../lib/token';
import fetch from 'node-fetch';

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

  const payload = verifyDownloadToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { url, quality, format } = payload;

  try {
    // Check if the URL is from a trusted domain
    const trustedDomains = [
      'googlevideo.com',
      'youtube.com',
      'ytimg.com',
      'vimeocdn.com',
      'vimeo.com'
    ];

    const urlObj = new URL(url);
    const isTrusted = trustedDomains.some(domain => urlObj.hostname.includes(domain));

    if (!isTrusted) {
      return res.status(403).json({ error: 'Untrusted video source' });
    }

    // For YouTube direct URLs, we can often redirect (saves bandwidth)
    if (urlObj.hostname.includes('googlevideo.com')) {
      // YouTube URLs typically work with direct redirect
      res.setHeader('Content-Disposition', `attachment; filename="video.${format}"`);
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

    // Stream the video through our server
    if (response.body) {
      response.body.pipe(res);
    } else {
      throw new Error('No response body');
    }
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Failed to download video' });
  }
}