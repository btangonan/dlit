import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const candidates = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    'node_modules/youtube-dl-exec/bin/yt-dlp',
    '/opt/homebrew/bin/yt-dlp'
  ];

  const results: any[] = [];

  for (const path of candidates) {
    try {
      const { stdout } = await execAsync(`"${path}" --version`, { timeout: 10000 });
      results.push({
        path,
        version: stdout.trim(),
        ok: true
      });
    } catch (e: any) {
      results.push({
        path,
        error: e?.message || String(e),
        ok: false
      });
    }
  }

  res.json({
    candidates: results,
    envPath: process.env.PATH,
    timestamp: new Date().toISOString()
  });
}