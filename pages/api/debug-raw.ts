import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function getYtdlpPath(): Promise<string> {
  const paths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'),
    '/opt/homebrew/bin/yt-dlp'
  ];

  for (const ytdlpPath of paths) {
    try {
      await execAsync(`"${ytdlpPath}" --version`);
      return ytdlpPath;
    } catch (e) {
      continue;
    }
  }
  throw new Error('yt-dlp not found');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🐛 DEBUG-RAW: Request received', {
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const ytdlpPath = await getYtdlpPath();
    console.log('🐛 DEBUG-RAW: Using yt-dlp at:', ytdlpPath);

    // Test with raw yt-dlp command with bot detection evasion to capture exact error
    const { stdout, stderr } = await execAsync(
      `"${ytdlpPath}" -j --no-warnings ` +
      `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" ` +
      `--add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" ` +
      `--add-header "Accept-Language:en-US,en;q=0.9" ` +
      `--add-header "Accept-Encoding:gzip, deflate, br" ` +
      `--add-header "DNT:1" ` +
      `--add-header "Connection:keep-alive" ` +
      `--add-header "Upgrade-Insecure-Requests:1" ` +
      `"${url}"`,
      {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 45000
      }
    );

    console.log('🐛 DEBUG-RAW: Success! stdout length:', stdout.length);
    console.log('🐛 DEBUG-RAW: stderr:', stderr);

    return res.status(200).json({
      success: true,
      ytdlpPath,
      stdout: stdout.substring(0, 1000) + '...', // Truncated for response
      stderr,
      message: 'Raw yt-dlp execution successful'
    });

  } catch (error: any) {
    console.error('🐛 DEBUG-RAW: Raw error captured:', {
      message: error.message,
      stderr: error.stderr,
      stdout: error.stdout,
      code: error.code,
      signal: error.signal,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      rawError: {
        message: error.message,
        stderr: error.stderr,
        stdout: error.stdout,
        code: error.code,
        signal: error.signal,
        killed: error.killed,
        cmd: error.cmd
      },
      timestamp: new Date().toISOString()
    });
  }
}