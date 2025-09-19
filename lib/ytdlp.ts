import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { LRUCache } from 'lru-cache';

const execAsync = promisify(exec);

// Cache extracted URLs for 5 minutes to avoid re-extraction
const cache = new LRUCache<string, VideoInfo>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Cookie file management for bot detection evasion
const COOKIE_FILE_PATH = path.join(process.cwd(), 'cookies.txt');

async function ensureCookieFile(): Promise<string | null> {
  try {
    await fs.access(COOKIE_FILE_PATH);
    console.log('🍪 Using existing cookie file for authentication');
    return COOKIE_FILE_PATH;
  } catch (error) {
    // Cookie file doesn't exist - we'll create a minimal one
    const minimalCookies = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	FALSE	0	CONSENT	YES+cb.20210328-17-p0.en+FX+000
.youtube.com	TRUE	/	TRUE	0	__Secure-3PSID	session_placeholder
.youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	visitor_placeholder
`;

    try {
      await fs.writeFile(COOKIE_FILE_PATH, minimalCookies, 'utf8');
      console.log('🍪 Created minimal cookie file for bot evasion');
      return COOKIE_FILE_PATH;
    } catch (writeError) {
      console.log('⚠️ Could not create cookie file, proceeding without cookies');
      return null;
    }
  }
}

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

    // Try minimal extraction first (works for most videos)
    let stdout, stderr;
    try {
      const result = await execAsync(
        `"${ytdlpPath}" -j --no-warnings "${videoUrl}"`,
        {
          maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large JSON
          timeout: 30000
        }
      );
      stdout = result.stdout;
      stderr = result.stderr;
      console.log('✅ Minimal extraction successful');
    } catch (minimalError: any) {
      // If we get bot detection error, try with targeted evasion
      if (minimalError.stderr && minimalError.stderr.includes('Sign in to confirm you\'re not a bot')) {
        console.log('🤖 Bot detection detected, trying cookie authentication...');

        // Try with cookies first
        const cookieFile = await ensureCookieFile();
        if (cookieFile) {
          try {
            const result = await execAsync(
              `"${ytdlpPath}" -j --no-warnings --cookies "${cookieFile}" "${videoUrl}"`,
              {
                maxBuffer: 1024 * 1024 * 50,
                timeout: 45000
              }
            );
            stdout = result.stdout;
            stderr = result.stderr;
            console.log('✅ Cookie authentication successful');
          } catch (cookieError: any) {
            console.log('🍪 Cookie authentication failed, trying Android client...');
            // Fallback to Android client with cookies
            try {
              const result = await execAsync(
                `"${ytdlpPath}" -j --no-warnings --cookies "${cookieFile}" --extractor-args "youtube:player_client=android" "${videoUrl}"`,
                {
                  maxBuffer: 1024 * 1024 * 50,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              console.log('✅ Android client + cookies successful');
            } catch (androidCookieError: any) {
              // Final fallback: iOS client with cookies
              console.log('📱 Android + cookies failed, trying iOS + cookies...');
              const result = await execAsync(
                `"${ytdlpPath}" -j --no-warnings --cookies "${cookieFile}" --extractor-args "youtube:player_client=ios" "${videoUrl}"`,
                {
                  maxBuffer: 1024 * 1024 * 50,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              console.log('✅ iOS client + cookies successful');
            }
          }
        } else {
          // No cookies available, fallback to original behavior
          console.log('🤖 No cookies available, trying Android client...');
          try {
            const result = await execAsync(
              `"${ytdlpPath}" -j --no-warnings --extractor-args "youtube:player_client=android" "${videoUrl}"`,
              {
                maxBuffer: 1024 * 1024 * 50,
                timeout: 45000
              }
            );
            stdout = result.stdout;
            stderr = result.stderr;
            console.log('✅ Android client extraction successful');
          } catch (androidError: any) {
            // If Android client fails, try iOS client
            console.log('📱 Android failed, trying iOS client...');
            const result = await execAsync(
              `"${ytdlpPath}" -j --no-warnings --extractor-args "youtube:player_client=ios" "${videoUrl}"`,
              {
                maxBuffer: 1024 * 1024 * 50,
                timeout: 45000
              }
            );
            stdout = result.stdout;
            stderr = result.stderr;
            console.log('✅ iOS client extraction successful');
          }
        }
      } else {
        // Re-throw if not bot detection
        throw minimalError;
      }
    }

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