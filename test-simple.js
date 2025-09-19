const { exec } = require('child_process');
const path = require('path');

// Test direct binary execution
const ytdlpPath = path.join(__dirname, 'node_modules/youtube-dl-exec/bin/yt-dlp');

exec(`"${ytdlpPath}" --version`, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('yt-dlp version:', stdout);
});

// Test with simple extraction
exec(`"${ytdlpPath}" -j "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`, (error, stdout, stderr) => {
  if (error) {
    console.error('Error extracting:', error.message);
    return;
  }

  try {
    const info = JSON.parse(stdout);
    console.log('Video title:', info.title);
    console.log('Formats count:', info.formats ? info.formats.length : 0);
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});