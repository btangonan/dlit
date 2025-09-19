import { NextApiRequest, NextApiResponse } from 'next';
import { getVideoInfo } from '../../lib/ytdlp';
import { generateDownloadToken } from '../../lib/token';
import { isRateLimited } from '../../lib/rateLimit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🎬 EXTRACT API: Request received', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent']
  });

  if (req.method !== 'POST') {
    console.log('❌ EXTRACT API: Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get IP for rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  console.log('🌐 EXTRACT API: IP address:', ip);

  // Check rate limit: 10 requests per minute
  if (isRateLimited(ip as string, 10, 60000)) {
    console.log('🚫 EXTRACT API: Rate limited for IP:', ip);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { url } = req.body;
  console.log('📹 EXTRACT API: Video URL requested:', url);

  if (!url) {
    console.log('❌ EXTRACT API: No URL provided');
    return res.status(400).json({ error: 'URL is required' });
  }

  // Basic URL validation for YouTube/Vimeo
  const isValidUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/.test(url);
  if (!isValidUrl) {
    console.log('❌ EXTRACT API: Invalid URL format:', url);
    return res.status(400).json({ error: 'Only YouTube and Vimeo URLs are supported' });
  }

  console.log('✅ EXTRACT API: URL validation passed, starting extraction...');

  try {
    // Get video info (cached if recently requested)
    console.log('🔄 EXTRACT API: Calling getVideoInfo...');
    const videoInfo = await getVideoInfo(url);
    console.log('✅ EXTRACT API: Video info extracted successfully:', {
      title: videoInfo.title,
      duration: videoInfo.duration,
      formatCount: videoInfo.formats.length
    });

    // Generate download tokens for each format
    console.log('🔐 EXTRACT API: Generating download tokens...');
    const formatsWithTokens = videoInfo.formats.map(format => ({
      ...format,
      downloadUrl: `/api/download?token=${generateDownloadToken(
        format.url,
        format.quality,
        format.format
      )}`
    }));

    console.log('🎉 EXTRACT API: Success! Returning response with', formatsWithTokens.length, 'formats');
    return res.status(200).json({
      success: true,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      formats: formatsWithTokens
    });
  } catch (error: any) {
    console.error('💥 EXTRACT API: Error occurred:', {
      message: error.message,
      stack: error.stack,
      url: url,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      error: error.message || 'Failed to extract video information. The video may be private or unavailable.'
    });
  }
}