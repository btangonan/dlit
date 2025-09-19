import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { LRUCache } from 'lru-cache';

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

async function getYtdlpPath(): Promise<string> {
  // Try different locations for yt-dlp - production environment first
  const paths = [
    '/usr/local/bin/yt-dlp',  // Render production path
    '/usr/bin/yt-dlp',        // Standard Linux path
    'yt-dlp',                 // System PATH
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'), // npm package
    '/opt/homebrew/bin/yt-dlp' // macOS homebrew
  ];

  for (const ytdlpPath of paths) {
    try {
      await execAsync(`"${ytdlpPath}" --version`);
      console.log(`✅ Found yt-dlp at: ${ytdlpPath}`);
      return ytdlpPath;
    } catch (e) {
      console.log(`❌ yt-dlp not found at: ${ytdlpPath}`);
      continue;
    }
  }

  throw new Error('yt-dlp not found in production environment. Binary installation may have failed.');
}

export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  const cacheKey = videoUrl;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const ytdlpPath = await getYtdlpPath();

    // Log yt-dlp version for debugging
    try {
      const { stdout: versionOutput } = await execAsync(`"${ytdlpPath}" --version`);
      console.log(`🔧 Using yt-dlp version: ${versionOutput.trim()} at ${ytdlpPath}`);
    } catch (e) {
      console.log(`⚠️ Could not get yt-dlp version from ${ytdlpPath}`);
    }

    // Execute yt-dlp to get video info with bot detection evasion
    const { stdout, stderr } = await execAsync(
      `"${ytdlpPath}" -j --no-warnings ` +
      `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
      `--add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" ` +
      `--add-header "Accept-Language:en-US,en;q=0.9" ` +
      `--add-header "Accept-Encoding:gzip, deflate, br" ` +
      `--add-header "DNT:1" ` +
      `--add-header "Connection:keep-alive" ` +
      `--add-header "Upgrade-Insecure-Requests:1" ` +
      `"${videoUrl}"`,
      {
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large JSON
        timeout: 45000 // Increased to 45 seconds for bot evasion
      }
    );

    if (stderr && !stderr.includes('WARNING')) {
      console.error('yt-dlp stderr:', stderr);
    }

    // Parse and validate the response
    let info;
    try {
      info = JSON.parse(stdout);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from yt-dlp: ${parseError.message}`);
    }

    // Validate that info is a valid object with expected structure
    if (!info || typeof info !== 'object' || Array.isArray(info)) {
      throw new Error('yt-dlp returned invalid video information structure');
    }

    // Extract available formats
    const formats: VideoFormat[] = [];

    // Add video formats
    const videoQualities = [
      { quality: '1080p', height: 1080 },
      { quality: '720p', height: 720 },
      { quality: '480p', height: 480 },
      { quality: '360p', height: 360 },
      { quality: '240p', height: 240 },
      { quality: '144p', height: 144 }
    ];

    videoQualities.forEach(({ quality, height }) => {
      const format = info.formats?.find((f: any) =>
        f.height === height && f.vcodec !== 'none' && f.vcodec !== null
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

    // Add best audio format
    const audioFormats = info.formats?.filter((f: any) =>
      f.acodec !== 'none' && f.acodec !== null && (f.vcodec === 'none' || f.vcodec === null)
    ).sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

    if (audioFormats && audioFormats.length > 0) {
      const bestAudio = audioFormats[0];
      formats.push({
        quality: 'Audio Only',
        format: 'mp3',
        url: bestAudio.url,
        filesize: bestAudio.filesize,
        hasAudio: true
      });
    }

    // If no formats found, try to get the best format available
    if (formats.length === 0 && info.url) {
      formats.push({
        quality: 'Best Available',
        format: info.ext || 'mp4',
        url: info.url,
        filesize: info.filesize,
        hasAudio: true
      });
    }

    const videoInfo: VideoInfo = {
      title: info.title || 'Unknown Title',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      formats
    };

    cache.set(cacheKey, videoInfo);
    return videoInfo;
  } catch (error: any) {
    const stderr = error?.stderr || '';
    const stdout = error?.stdout || '';
    const code = typeof error?.code === 'number' ? error.code : undefined;

    console.error('yt-dlp FAILED', {
      code,
      stderr: stderr?.slice(0, 4000),
      stdout: stdout?.slice(0, 1000),
      message: error.message
    });

    // Prefer informative stderr to generic message
    const msg = stderr?.trim() || error.message || 'Unknown yt-dlp error';

    // Enhanced error messages for production debugging
    if (error.message.includes('yt-dlp not found')) {
      throw new Error('Video extraction service unavailable: yt-dlp binary not installed');
    } else if (error.message.includes('timeout')) {
      throw new Error('Video extraction timeout: The video may be too large or service busy');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      throw new Error('Network error: Unable to connect to video service');
    } else if (error.message.includes('Invalid JSON')) {
      throw new Error('Video processing error: Invalid response from extraction service');
    } else {
      throw new Error(msg);
    }
  }
}