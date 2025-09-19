import path from 'path';
import { promises as fs } from 'fs';
import { LRUCache } from 'lru-cache';
import { safeExecute } from './safeExec';
import BrowserCookieExtractor from './cookieExtractor';
import { assertAllowedUrl, sanitizeUrlForLogging } from './urls';

// Cache extracted URLs for 5 minutes to avoid re-extraction
const cache = new LRUCache<string, VideoInfo>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Cookie authentication for bot-resistant videos - Production deployment v2

// Cookie file management for bot detection evasion
const COOKIE_FILE_PATH = path.join(process.cwd(), 'cookies.txt');

async function ensureCookieFile(): Promise<string | null> {
  try {
    // First try to extract fresh cookies from browsers
    const cookieExtractor = new BrowserCookieExtractor();
    const extractedCookieFile = await cookieExtractor.extractVimeoCookies();

    if (extractedCookieFile) {
      console.log('🍪 Using fresh browser cookies for authentication');
      return extractedCookieFile;
    }

    // Fallback: check for existing static cookie file
    await fs.access(COOKIE_FILE_PATH);
    console.log('🍪 Using existing static cookie file for authentication');
    return COOKIE_FILE_PATH;
  } catch (error) {
    // Create minimal YouTube cookies for bot evasion
    const minimalCookies = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	FALSE	0	CONSENT	YES+cb.20210328-17-p0.en+FX+000
.youtube.com	TRUE	/	TRUE	0	__Secure-3PSID	session_placeholder
.youtube.com	TRUE	/	FALSE	0	VISITOR_INFO1_LIVE	visitor_placeholder
`;

    try {
      await fs.writeFile(COOKIE_FILE_PATH, minimalCookies, 'utf8');
      console.log('🍪 Created minimal cookie file for YouTube bot evasion');
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
  canMergeAudio?: boolean;
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
      await safeExecute(ytdlpPath, ['--version']);
      console.log(`✅ Found yt-dlp at: ${ytdlpPath}`);
      return ytdlpPath;
    } catch (e) {
      console.log(`❌ yt-dlp not found at: ${ytdlpPath}`);
      continue;
    }
  }

  throw new Error('yt-dlp not found in production environment. Binary installation may have failed.');
}

// Platform detection helper
function detectPlatform(url: string): 'youtube' | 'vimeo' {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.toLowerCase();

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  } else if (hostname.includes('vimeo.com')) {
    return 'vimeo';
  }

  // Default to youtube for backward compatibility
  return 'youtube';
}

export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  const cacheKey = videoUrl;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const ytdlpPath = await getYtdlpPath();

    // Validate URL before processing
    const validatedUrl = assertAllowedUrl(videoUrl);
    const sanitizedUrl = sanitizeUrlForLogging(videoUrl);
    const platform = detectPlatform(videoUrl);
    console.log(`🔍 Processing ${platform} video from: ${sanitizedUrl}`);

    // Log yt-dlp version for debugging
    try {
      const { stdout: versionOutput } = await safeExecute(ytdlpPath, ['--version']);
      console.log(`🔧 Using yt-dlp version: ${versionOutput.trim()} at ${ytdlpPath}`);
    } catch (e) {
      console.log(`⚠️ Could not get yt-dlp version from ${ytdlpPath}`);
    }

    // Platform-specific extraction strategies
    let stdout, stderr;
    let extractionSuccessful = false;

    if (platform === 'vimeo') {
      // Enhanced Vimeo extraction strategy with browser impersonation
      try {
        console.log('🎯 Trying enhanced Vimeo extraction with multiple strategies...');

        // Get cookie file from browser extraction
        const cookieFile = await ensureCookieFile();
        let extractionAttempted = false;

        // Strategy 1: Browser impersonation with cookies (most effective)
        if (cookieFile) {
          const impersonationTargets = [
            'Chrome-131',     // Latest Chrome
            'Chrome-120',     // Stable Chrome
            'Safari-18.0',    // Latest Safari
            'Firefox-135'     // Latest Firefox
          ];

          for (const target of impersonationTargets) {
            try {
              console.log(`🎭 Trying Vimeo with ${target} impersonation + cookies...`);
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--impersonate', target, '--cookies', cookieFile, validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              extractionAttempted = true;
              extractionSuccessful = true;
              console.log(`✅ Vimeo extraction with ${target} impersonation successful`);
              break;
            } catch (impersonationError: any) {
              console.log(`🎭 ${target} impersonation failed, trying next...`);
              continue;
            }
          }

          // Strategy 2: Fallback to cookies without impersonation
          if (!extractionAttempted) {
            try {
              console.log('🍪 Trying Vimeo with browser cookies (no impersonation)...');
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--cookies', cookieFile, validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 30000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              extractionAttempted = true;
              extractionSuccessful = true;
              console.log('✅ Vimeo extraction with cookies successful');
            } catch (cookieError: any) {
              console.log('🍪 Vimeo cookie extraction failed, trying impersonation without cookies...');
            }
          }
        }

        // Strategy 3: Browser impersonation without cookies
        if (!extractionAttempted) {
          const impersonationTargets = ['Chrome-131', 'Safari-18.0', 'Firefox-135'];

          for (const target of impersonationTargets) {
            try {
              console.log(`🎭 Trying Vimeo with ${target} impersonation (no cookies)...`);
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--impersonate', target, validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 30000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              extractionAttempted = true;
              extractionSuccessful = true;
              console.log(`✅ Vimeo extraction with ${target} impersonation successful`);
              break;
            } catch (impersonationError: any) {
              console.log(`🎭 ${target} impersonation failed, trying next...`);
              continue;
            }
          }
        }

        // Strategy 4: Last resort - standard extraction
        if (!extractionAttempted) {
          console.log('🎯 Trying Vimeo standard extraction as last resort...');
          const result = await safeExecute(
            ytdlpPath,
            ['-j', '--no-warnings', validatedUrl.href],
            {
              maxBuffer: 50 * 1024 * 1024,
              timeout: 30000
            }
          );
          stdout = result.stdout;
          stderr = result.stderr;
          extractionSuccessful = true;
          console.log('✅ Vimeo standard extraction successful');
        }
      } catch (vimeoError: any) {
        // Enhanced error detection for Vimeo authentication requirements
        const errorStr = (vimeoError.stderr || '') + (vimeoError.message || '');
        if (errorStr.includes('private') ||
            errorStr.includes('password') ||
            errorStr.includes('logged-in') ||
            errorStr.includes('login') ||
            errorStr.includes('authentication') ||
            errorStr.includes('web client only works when logged-in')) {
          console.log('🔒 Vimeo requires authentication');
          throw new Error('This Vimeo video requires authentication. Please log into Vimeo in your browser first, then try again. The app will use your browser cookies for access.');
        } else {
          throw vimeoError;
        }
      }
    } else {
      // YouTube extraction strategies - prioritize quality over bot detection evasion
      // Strategy 1: Try standard extraction first (gives all quality options)
      try {
        console.log('🎯 Trying YouTube standard extraction for full quality options...');
        const result = await safeExecute(
          ytdlpPath,
          ['-j', '--no-warnings', validatedUrl.href],
          {
            maxBuffer: 50 * 1024 * 1024,
            timeout: 30000
          }
        );
        stdout = result.stdout;
        stderr = result.stderr;
        extractionSuccessful = true;
        console.log('✅ YouTube standard extraction successful');
      } catch (standardError: any) {
        console.log('📋 YouTube standard extraction failed, trying Android client...');

        // Strategy 2: Fallback to Android client (bypasses bot detection but limited quality)
        try {
          console.log('🤖 Trying YouTube Android client extraction...');
          const result = await safeExecute(
            ytdlpPath,
            ['-j', '--no-warnings', '--extractor-args', 'youtube:player_client=android', validatedUrl.href],
            {
              maxBuffer: 50 * 1024 * 1024,
              timeout: 30000
            }
          );
          stdout = result.stdout;
          stderr = result.stderr;
          extractionSuccessful = true;
          console.log('✅ YouTube Android client extraction successful');
        } catch (androidError: any) {
          // Strategy 3: If we get bot detection error, try with targeted evasion
          if (androidError.stderr && androidError.stderr.includes('Sign in to confirm you\'re not a bot')) {
            console.log('🤖 YouTube bot detection detected, trying cookie authentication...');

          // Try with cookies first
          const cookieFile = await ensureCookieFile();
          if (cookieFile) {
            try {
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--cookies', cookieFile, validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              console.log('✅ YouTube cookie authentication successful');
            } catch (cookieError: any) {
              console.log('🍪 YouTube cookie authentication failed, trying Android client...');
              // Fallback to Android client with cookies
              try {
                const result = await safeExecute(
                  ytdlpPath,
                  ['-j', '--no-warnings', '--cookies', cookieFile, '--extractor-args', 'youtube:player_client=android', validatedUrl.href],
                  {
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 45000
                  }
                );
                stdout = result.stdout;
                stderr = result.stderr;
                console.log('✅ YouTube Android client + cookies successful');
              } catch (androidCookieError: any) {
                // Final fallback: iOS client with cookies
                console.log('📱 YouTube Android + cookies failed, trying iOS + cookies...');
                const result = await safeExecute(
                  ytdlpPath,
                  ['-j', '--no-warnings', '--cookies', cookieFile, '--extractor-args', 'youtube:player_client=ios', validatedUrl.href],
                  {
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 45000
                  }
                );
                stdout = result.stdout;
                stderr = result.stderr;
                console.log('✅ YouTube iOS client + cookies successful');
              }
            }
          } else {
            // No cookies available, fallback to original behavior
            console.log('🤖 No YouTube cookies available, trying Android client...');
            try {
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--extractor-args', 'youtube:player_client=android', validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              console.log('✅ YouTube Android client extraction successful');
            } catch (androidError: any) {
              // If Android client fails, try iOS client
              console.log('📱 YouTube Android failed, trying iOS client...');
              const result = await safeExecute(
                ytdlpPath,
                ['-j', '--no-warnings', '--extractor-args', 'youtube:player_client=ios', validatedUrl.href],
                {
                  maxBuffer: 50 * 1024 * 1024,
                  timeout: 45000
                }
              );
              stdout = result.stdout;
              stderr = result.stderr;
              console.log('✅ YouTube iOS client extraction successful');
            }
          }
        } else {
          // Re-throw if not bot detection
          throw androidError;
        }
        }
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

    // Extract available formats with enhanced audio strategy
    const formats: VideoFormat[] = [];

    // Check for best audio format availability for merging
    const audioFormats = info.formats?.filter((f: any) =>
      f.acodec !== 'none' && f.acodec !== null && (f.vcodec === 'none' || f.vcodec === null)
    ).sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));

    const hasSeparateAudio = audioFormats && audioFormats.length > 0;
    console.log(`🎵 Platform: ${detectPlatform(videoUrl)}, Separate audio available: ${hasSeparateAudio}`);

    // Add video formats with intelligent audio handling
    const videoQualities = [
      { quality: '1080p', height: 1080 },
      { quality: '720p', height: 720 },
      { quality: '480p', height: 480 },
      { quality: '360p', height: 360 },
      { quality: '240p', height: 240 },
      { quality: '144p', height: 144 }
    ];

    videoQualities.forEach(({ quality, height }) => {
      // Strategy 1: Look for combined video+audio formats first (ideal)
      let format = info.formats?.find((f: any) =>
        f.height === height && f.vcodec !== 'none' && f.vcodec !== null &&
        f.acodec !== 'none' && f.acodec !== null
      );

      let hasAudio = false;
      let canMergeAudio = false;

      if (format) {
        // Found combined format with audio
        hasAudio = true;
        canMergeAudio = false; // No merging needed
        console.log(`✅ ${quality}: Combined format with audio`);
      } else {
        // Strategy 2: Look for video-only format that can be merged with audio
        format = info.formats?.find((f: any) =>
          f.height === height && f.vcodec !== 'none' && f.vcodec !== null
        );

        if (format && hasSeparateAudio) {
          // Video-only format available + separate audio available = can merge
          hasAudio = false; // Format itself has no audio
          canMergeAudio = true; // But we can merge audio during download
          console.log(`🎵 ${quality}: Video-only format, audio will be merged during download`);
        } else if (format) {
          // Video-only format but no separate audio available
          hasAudio = false;
          canMergeAudio = false;
          console.log(`⚠️ ${quality}: Video-only format, no audio available for merging`);
        }
      }

      if (format) {
        formats.push({
          quality,
          format: 'mp4',
          url: format.url,
          filesize: format.filesize,
          hasAudio,
          canMergeAudio
        });
      }
    });

    // Add audio-only format if available
    if (hasSeparateAudio && audioFormats.length > 0) {
      const bestAudio = audioFormats[0];
      formats.push({
        quality: 'Audio Only',
        format: 'mp3',
        url: bestAudio.url,
        filesize: bestAudio.filesize,
        hasAudio: true,
        canMergeAudio: false // Already audio-only
      });
      console.log(`🎵 Audio-only format added: ${bestAudio.abr || 'unknown'}kbps`);
    }

    // If no formats found, try to get the best format available
    if (formats.length === 0 && info.url) {
      formats.push({
        quality: 'Best Available',
        format: info.ext || 'mp4',
        url: info.url,
        filesize: info.filesize,
        hasAudio: true,
        canMergeAudio: false // Single format, no merging needed
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

    // Enhanced platform-specific error messages for production debugging
    const platform = detectPlatform(videoUrl);

    if (error.message.includes('yt-dlp not found')) {
      throw new Error('Video extraction service unavailable: yt-dlp binary not installed');
    } else if (error.message.includes('timeout')) {
      throw new Error(`${platform === 'vimeo' ? 'Vimeo' : 'YouTube'} extraction timeout: The video may be too large or service busy`);
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      throw new Error(`Network error: Unable to connect to ${platform === 'vimeo' ? 'Vimeo' : 'YouTube'} service`);
    } else if (error.message.includes('Invalid JSON')) {
      throw new Error('Video processing error: Invalid response from extraction service');
    } else if (platform === 'vimeo' && (msg.includes('private') || msg.includes('password') || msg.includes('requires a password') || msg.includes('logged-in') || msg.includes('login') || msg.includes('authentication') || msg.includes('web client only works when logged-in'))) {
      throw new Error('This Vimeo video requires authentication. Vimeo now requires login for most videos. Please try YouTube instead, or ensure browser cookies are available.');
    } else if (platform === 'vimeo' && msg.includes('Premium membership required')) {
      throw new Error('This Vimeo video requires a Premium membership. Please try a free Vimeo video.');
    } else if (platform === 'youtube' && msg.includes('Sign in to confirm')) {
      throw new Error('YouTube detected automated access. Please try again later or use a different video.');
    } else if (platform === 'youtube' && msg.includes('Video unavailable')) {
      throw new Error('This YouTube video is unavailable in your region or has been removed.');
    } else if (platform === 'vimeo' && msg.includes('404')) {
      throw new Error('Vimeo video not found. Please check the URL and try again.');
    } else if (platform === 'youtube' && msg.includes('age-restricted')) {
      throw new Error('This YouTube video is age-restricted and cannot be downloaded.');
    } else {
      // Generic error with platform context
      const platformName = platform === 'vimeo' ? 'Vimeo' : 'YouTube';
      throw new Error(`${platformName} extraction failed: ${msg}`);
    }
  }
}