const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import the yt-dlp functionality from the existing lib
// Note: We'll need to transpile these or create JS versions
let getVideoInfo, safeExecute;

// Dynamic import for TypeScript files
async function loadLibs() {
  try {
    // For now, we'll implement the core functionality directly
    // In a real setup, we'd transpile the TS files or use ts-node
    const { LRUCache } = require('lru-cache');
    const ytdlp = require('youtube-dl-exec');

    // Platform-aware video extraction
    getVideoInfo = async (url) => {
      // Detect platform
      const platform = url.includes('vimeo.com') ? 'vimeo' : 'youtube';
      console.log(`🔍 Electron: Extracting ${platform} video`);

      // Platform-specific extraction arguments
      const extractorArgs = platform === 'youtube' ? 'youtube:player_client=android' : undefined;
      const options = {
        dumpSingleJson: true,
        noWarnings: true
      };

      if (extractorArgs) {
        options.extractorArgs = extractorArgs;
      }

      const info = await ytdlp(url, options);

      // Enhanced format processing with audio detection
      const formats = info.formats?.map(f => {
        const quality = f.height ? `${f.height}p` : (f.acodec !== 'none' ? 'Audio Only' : 'unknown');
        return {
          quality,
          format: f.ext || 'mp4',
          url: f.url,
          filesize: f.filesize,
          hasAudio: f.acodec !== 'none' && f.acodec !== null,
          canMergeAudio: f.acodec === 'none' && f.vcodec !== 'none' // Video-only that can be merged
        };
      }) || [];

      console.log(`✅ Electron: Found ${formats.length} formats for ${platform} video`);

      return {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        formats
      };
    };

    safeExecute = async (command, args, options = {}) => {
      const { spawn } = require('child_process');
      return new Promise((resolve, reject) => {
        const proc = spawn(command, args, options);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data;
        });

        proc.stderr.on('data', (data) => {
          stderr += data;
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            const error = new Error(`Command failed with code ${code}`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          }
        });
      });
    };

  } catch (error) {
    console.error('Failed to load libraries:', error);
  }
}

// Load libraries on startup
loadLibs();

// Handle video extraction
ipcMain.handle('extract-video', async (event, url) => {
  try {
    if (!getVideoInfo) {
      throw new Error('Video extraction service not ready');
    }
    console.log('📹 Extracting video info for:', url);
    const videoInfo = await getVideoInfo(url);
    console.log('✅ Extraction successful:', videoInfo.title);
    return { success: true, data: videoInfo };
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Handle video download
ipcMain.handle('download-video', async (event, { url, quality, format, outputPath }) => {
  try {
    console.log('⬇️ Starting download:', { quality, format, outputPath });

    // Get yt-dlp path (reuse the same logic from ytdlp.ts)
    const ytdlpPath = await getYtdlpPath();

    // Create download arguments
    const args = [
      url,
      '-o', outputPath,
      '--no-warnings',
      '--extractor-args', 'youtube:player_client=android'
    ];

    // Platform-aware quality selection with enhanced audio merging
    if (quality && quality !== 'Best Available') {
      if (quality === 'Audio Only') {
        args.push('-f', 'bestaudio');
        console.log('🎵 Downloading audio-only format');
      } else {
        const height = quality.replace('p', '');

        // Enhanced format selector that prioritizes quality and ensures audio
        // First try: combined format with exact height
        // Second try: combined format with height limit
        // Third try: merge video+audio with height limit
        // Fallback: best available with height limit
        const formatSelector = `best[height=${height}]/bestvideo[height=${height}]+bestaudio/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

        args.push('-f', formatSelector);
        console.log(`🎵 Enhanced format selector for ${quality}: ${formatSelector}`);
      }
    } else {
      // For 'Best Available', use smart format selection
      args.push('-f', 'best[height<=1080]/bestvideo[height<=1080]+bestaudio/best');
      console.log('🎵 Using smart format selection for best quality');
    }

    console.log('🔧 Running yt-dlp with args:', args);

    // Execute download with progress tracking
    const result = await safeExecute(ytdlpPath, args, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 300000 // 5 minutes
    });

    console.log('✅ Download completed successfully');
    return { success: true, data: 'Download completed' };

  } catch (error) {
    console.error('❌ Download failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Handle save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(options);
    return result;
  } catch (error) {
    console.error('❌ Save dialog failed:', error.message);
    return { canceled: true };
  }
});

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// Helper function to get yt-dlp path (copied from ytdlp.ts)
async function getYtdlpPath() {
  const paths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'),
    '/opt/homebrew/bin/yt-dlp'
  ];

  for (const ytdlpPath of paths) {
    try {
      await safeExecute(ytdlpPath, ['--version']);
      console.log(`✅ Found yt-dlp at: ${ytdlpPath}`);
      return ytdlpPath;
    } catch (e) {
      continue;
    }
  }

  throw new Error('yt-dlp not found');
}