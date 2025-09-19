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
  // Try different locations for yt-dlp
  const paths = [
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'),
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    'yt-dlp'
  ];

  for (const ytdlpPath of paths) {
    try {
      await execAsync(`"${ytdlpPath}" --version`);
      return ytdlpPath;
    } catch (e) {
      continue;
    }
  }

  throw new Error('yt-dlp not found. Please install it: brew install yt-dlp');
}

export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  const cacheKey = videoUrl;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const ytdlpPath = await getYtdlpPath();

    // Execute yt-dlp to get video info
    const { stdout, stderr } = await execAsync(
      `"${ytdlpPath}" -j --no-warnings "${videoUrl}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 30000 // 30 seconds timeout
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
    console.error('Error extracting video info:', error.message);
    throw new Error(`Failed to extract video information. The video may be private or unavailable: ${error.message}`);
  }
}