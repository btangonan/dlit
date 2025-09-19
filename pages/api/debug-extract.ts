import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    binary: {},
    execution: {},
    error: null
  };

  try {
    // Test 1: Binary Detection and Permissions
    const ytdlpPaths = [
      path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp'),
      '/opt/homebrew/bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      'yt-dlp'
    ];

    for (const ytdlpPath of ytdlpPaths) {
      try {
        const stats = await fs.promises.stat(ytdlpPath).catch(() => null);
        const versionResult = await execAsync(`"${ytdlpPath}" --version`, { timeout: 5000 }).catch(e => ({ error: e.message }));

        diagnostics.binary[ytdlpPath] = {
          exists: !!stats,
          executable: stats ? (stats.mode & 0o111) !== 0 : false,
          size: stats?.size || 0,
          version: 'error' in versionResult ? versionResult.error : versionResult.stdout?.trim(),
          accessible: !('error' in versionResult)
        };
      } catch (e) {
        diagnostics.binary[ytdlpPath] = { error: e.message };
      }
    }

    // Test 2: Working Binary Path Detection
    let workingBinary = null;
    for (const [path, info] of Object.entries(diagnostics.binary)) {
      if ((info as any).accessible && !(info as any).error) {
        workingBinary = path;
        break;
      }
    }

    if (!workingBinary) {
      throw new Error('No working yt-dlp binary found');
    }

    // Test 3: Simple Video Info Extraction
    const testUrl = req.body.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll as test

    try {
      const { stdout, stderr } = await execAsync(
        `"${workingBinary}" -j --no-warnings "${testUrl}"`,
        {
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        }
      );

      diagnostics.execution = {
        binary: workingBinary,
        success: true,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        hasValidJson: false
      };

      // Test JSON parsing
      try {
        const info = JSON.parse(stdout);
        diagnostics.execution.hasValidJson = true;
        diagnostics.execution.videoInfo = {
          title: info.title || 'Unknown',
          duration: info.duration || 0,
          formatCount: info.formats?.length || 0
        };
      } catch (parseError) {
        diagnostics.execution.jsonParseError = parseError.message;
        diagnostics.execution.stdoutSample = stdout.substring(0, 500);
      }

    } catch (execError) {
      diagnostics.execution = {
        binary: workingBinary,
        success: false,
        error: execError.message,
        timeout: execError.signal === 'SIGTERM',
        memoryIssue: execError.message.includes('memory') || execError.message.includes('ENOMEM')
      };
    }

    // Test 4: System Resource Check
    diagnostics.system = {
      memoryAfter: process.memoryUsage(),
      diskSpace: await execAsync('df -h .').then(r => r.stdout).catch(e => e.message),
      processes: await execAsync('ps aux | head -10').then(r => r.stdout).catch(e => e.message)
    };

    return res.status(200).json({
      success: true,
      diagnostics
    });

  } catch (error) {
    diagnostics.error = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    };

    return res.status(500).json({
      success: false,
      diagnostics,
      error: 'Diagnostic test failed'
    });
  }
}