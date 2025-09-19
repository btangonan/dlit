import { NextApiRequest, NextApiResponse } from 'next';
import { getVideoInfo } from '../../lib/ytdlp';
import { generateDownloadToken } from '../../lib/token';
import { isRateLimited } from '../../lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get IP for rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Check rate limit: 10 requests per minute
  if (isRateLimited(ip as string, 10, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Basic URL validation for YouTube/Vimeo
  const isValidUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/.test(url);
  if (!isValidUrl) {
    return res.status(400).json({ error: 'Only YouTube and Vimeo URLs are supported' });
  }

  try {
    // Get video info (cached if recently requested)
    const videoInfo = await getVideoInfo(url);

    // Generate download tokens for each format
    const formatsWithTokens = videoInfo.formats.map(format => ({
      ...format,
      downloadUrl: `/api/download?token=${generateDownloadToken(
        format.url,
        format.quality,
        format.format
      )}`
    }));

    return res.status(200).json({
      success: true,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      formats: formatsWithTokens
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return res.status(500).json({
      error: 'Failed to extract video information. The video may be private or unavailable.'
    });
  }
}