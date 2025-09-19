import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { LRUCache } from 'lru-cache';
import fs from 'fs';

const execAsync = promisify(exec);

// Cache extracted URLs for 5 minutes to avoid re-extraction
const cache = new LRUCache<string, VideoInfo>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
}

export interface VideoFormat {
  quality: string;
  format: string;
  url: string;
  filesize?: number;
  hasAudio: boolean;
}

// Production-optimized binary detection
async function getYtdlpPath(): Promise<string> {
  // Prioritize production environments first
  const paths = [
    // Render/Docker environments
    '/usr/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    // npm package location (works in development)
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'),
    // Homebrew/macOS (development)
    '/opt/homebrew/bin/yt-dlp',
    // Global PATH
    'yt-dlp'
  ];

  const detectionResults = [];

  for (const ytdlpPath of paths) {
    try {
      // Fast file existence check first
      if (ytdlpPath.startsWith('/') || ytdlpPath.includes('/')) {
        try {
          const stats = await fs.promises.stat(ytdlpPath);
          if (!stats.isFile()) continue;
        } catch {
          continue; // File doesn't exist
        }
      }

      // Test binary execution with short timeout
      const { stdout } = await execAsync(`"${ytdlpPath}" --version`, {
        timeout: 3000,
        maxBuffer: 1024
      });

      if (stdout && stdout.trim()) {
        console.log(`✅ yt-dlp binary found at: ${ytdlpPath} (${stdout.trim()})`);
        return ytdlpPath;
      }
    } catch (error) {
      detectionResults.push(`${ytdlpPath}: ${error.message}`);
      continue;
    }
  }

  // Enhanced error reporting for production debugging
  const errorMessage = `yt-dlp binary not found. Tried paths: ${detectionResults.join(', ')}. Platform: ${process.platform}, Arch: ${process.arch}`;
  console.error('❌ Binary detection failed:', errorMessage);
  throw new Error(errorMessage);
}

// Production-optimized video extraction with enhanced error handling
export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  const cacheKey = videoUrl;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let ytdlpPath: string;
  let executionStartTime = Date.now();

  try {
    ytdlpPath = await getYtdlpPath();
    console.log(`🔧 Using yt-dlp at: ${ytdlpPath}`);
  } catch (binaryError) {
    console.error('💥 Binary detection failed:', binaryError.message);
    throw new Error(`Binary not available: ${binaryError.message}`);
  }

  try {
    // Enhanced command with production-specific optimizations
    const command = `"${ytdlpPath}" -j --no-warnings --no-check-certificates --prefer-insecure "${videoUrl}"`;
    console.log(`🚀 Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: 30000, // 30 seconds timeout
      env: {
        ...process.env,
        // Production environment optimizations
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1'
      }
    });

    const executionTime = Date.now() - executionStartTime;
    console.log(`⏱️ Extraction completed in ${executionTime}ms`);

    // Log stderr but don't fail on warnings
    if (stderr && !stderr.includes('WARNING')) {
      console.warn('⚠️ yt-dlp stderr:', stderr);
    }

    // Validate and parse response
    if (!stdout || stdout.trim().length === 0) {
      throw new Error('Empty response from yt-dlp');
    }

    let info;
    try {
      info = JSON.parse(stdout);
    } catch (parseError) {
      console.error('❌ JSON parse failed. Response length:', stdout.length);
      console.error('Response sample:', stdout.substring(0, 200));
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    // Enhanced validation
    if (!info || typeof info !== 'object' || Array.isArray(info)) {
      console.error('❌ Invalid info structure:', typeof info, Array.isArray(info));
      throw new Error('Invalid video information structure from yt-dlp');
    }

    if (!info.title && !info.formats && !info.url) {
      console.error('❌ Missing essential video data');
      throw new Error('Video information incomplete - may be private or unavailable');
    }

    // Enhanced format extraction with fallbacks
    const formats: VideoFormat[] = [];

    // Primary: Extract quality-specific formats
    if (info.formats && Array.isArray(info.formats)) {
      const videoQualities = [
        { quality: '1080p', height: 1080 },
        { quality: '720p', height: 720 },
        { quality: '480p', height: 480 },
        { quality: '360p', height: 360 },
        { quality: '240p', height: 240 },
        { quality: '144p', height: 144 }
      ];

      videoQualities.forEach(({ quality, height }) => {
        const format = info.formats.find((f: any) =>
          f.height === height && f.vcodec !== 'none' && f.vcodec !== null && f.url
        );
        if (format) {
          formats.push({
            quality,
            format: 'mp4',
            url: format.url,
            filesize: format.filesize,
            hasAudio: format.acodec !== 'none' && format.acodec !== null
          });
        }
      });

      // Audio-only format
      const audioFormats = info.formats
        .filter((f: any) => f.acodec !== 'none' && f.acodec !== null &&
                           (f.vcodec === 'none' || f.vcodec === null) && f.url)
        .sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

      if (audioFormats.length > 0) {
        formats.push({
          quality: 'Audio Only',
          format: 'mp3',
          url: audioFormats[0].url,
          filesize: audioFormats[0].filesize,
          hasAudio: true
        });
      }
    }

    // Fallback: Use direct URL if no formats extracted
    if (formats.length === 0 && info.url) {
      console.log('🔄 Using fallback direct URL');
      formats.push({
        quality: 'Best Available',
        format: info.ext || 'mp4',
        url: info.url,
        filesize: info.filesize,
        hasAudio: true
      });
    }

    if (formats.length === 0) {
      throw new Error('No downloadable formats found - video may be restricted');
    }

    const videoInfo: VideoInfo = {
      title: info.title || 'Unknown Title',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      formats
    };

    console.log(`✅ Successfully extracted: "${videoInfo.title}" with ${formats.length} formats`);
    cache.set(cacheKey, videoInfo);
    return videoInfo;

  } catch (error: any) {
    const executionTime = Date.now() - executionStartTime;

    // Enhanced error categorization for better debugging
    let errorCategory = 'unknown';
    let userMessage = 'Failed to extract video information';

    if (error.signal === 'SIGTERM' || error.code === 'TIMEOUT') {
      errorCategory = 'timeout';
      userMessage = 'Video extraction timed out - video may be too large or slow to process';
    } else if (error.message.includes('ENOMEM') || error.message.includes('memory')) {
      errorCategory = 'memory';
      userMessage = 'Insufficient memory to process video';
    } else if (error.message.includes('network') || error.message.includes('DNS')) {
      errorCategory = 'network';
      userMessage = 'Network error - unable to access video';
    } else if (error.message.includes('private') || error.message.includes('unavailable')) {
      errorCategory = 'access';
      userMessage = 'Video is private, restricted, or unavailable';
    } else if (error.message.includes('Binary not available')) {
      errorCategory = 'binary';
      userMessage = 'Video extraction service unavailable';
    }

    console.error(`❌ Extraction failed [${errorCategory}] after ${executionTime}ms:`, error.message);

    // Production: Don't expose internal details
    const publicError = process.env.NODE_ENV === 'production'
      ? userMessage
      : `${userMessage}: ${error.message}`;

    throw new Error(publicError);
  }
}