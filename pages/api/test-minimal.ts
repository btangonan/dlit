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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const ytdlpPath = await getYtdlpPath();

    // Test with MINIMAL arguments - no headers, no user-agent
    const { stdout, stderr } = await execAsync(
      `"${ytdlpPath}" -j --no-warnings "${url}"`,
      {
        maxBuffer: 1024 * 1024 * 50,
        timeout: 30000
      }
    );

    return res.status(200).json({
      success: true,
      ytdlpPath,
      titleExtracted: JSON.parse(stdout).title || 'No title',
      message: 'Minimal extraction successful'
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.stderr || error.message,
      ytdlpPath: await getYtdlpPath().catch(() => 'unknown')
    });
  }
}