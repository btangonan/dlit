import { NextApiRequest, NextApiResponse } from 'next';
import { getVideoInfo } from '../../lib/ytdlp-production';
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

  // Log request for production debugging
  console.log(`🎬 Video extraction request: ${url} from ${ip}`);

  try {
    // Get video info using production-optimized implementation
    const videoInfo = await getVideoInfo(url);

    // Generate download tokens for each format
    const formatsWithTokens = await Promise.all(
      videoInfo.formats.map(async format => ({
        ...format,
        downloadUrl: `/api/download?token=${await generateDownloadToken(
          format.url,
          format.quality,
          format.format
        )}`
      }))
    );

    console.log(`✅ Successfully extracted: "${videoInfo.title}" with ${formatsWithTokens.length} formats`);

    return res.status(200).json({
      success: true,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      duration: videoInfo.duration,
      formats: formatsWithTokens,
      // Debug info for production (remove in stable version)
      _debug: process.env.NODE_ENV === 'production' ? {
        platform: process.platform,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      } : undefined
    });

  } catch (error: any) {
    console.error(`❌ Extraction failed for ${url}:`, error.message);

    // Enhanced error responses based on error type
    let statusCode = 500;
    let errorMessage = 'Failed to extract video information. The video may be private or unavailable.';

    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      statusCode = 408;
      errorMessage = 'Video extraction timed out. Please try again with a shorter video.';
    } else if (error.message.includes('memory') || error.message.includes('ENOMEM')) {
      statusCode = 507;
      errorMessage = 'Video is too large to process. Please try a shorter video.';
    } else if (error.message.includes('Binary not available')) {
      statusCode = 503;
      errorMessage = 'Video extraction service is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('network') || error.message.includes('DNS')) {
      statusCode = 502;
      errorMessage = 'Unable to access video due to network issues. Please check the URL and try again.';
    } else if (error.message.includes('private') || error.message.includes('restricted')) {
      statusCode = 403;
      errorMessage = 'This video is private, restricted, or unavailable for download.';
    }

    return res.status(statusCode).json({
      error: errorMessage,
      // Include error details for debugging (only in development)
      _debug: process.env.NODE_ENV !== 'production' ? {
        originalError: error.message,
        platform: process.platform,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      } : undefined
    });
  }
}