import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

// Same logic as ytdlp.ts
const COOKIE_FILE_PATH = path.join(process.cwd(), 'cookies.txt');

async function ensureCookieFile(): Promise<string | null> {
  try {
    await fs.access(COOKIE_FILE_PATH);
    console.log('🍪 Using existing cookie file for authentication');
    return COOKIE_FILE_PATH;
  } catch (error) {
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
  console.log('🧪 COOKIE DEBUG: Request received');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const ytdlpPath = await getYtdlpPath();
    console.log('🧪 COOKIE DEBUG: Using yt-dlp at:', ytdlpPath);

    // Test cookie file creation
    const cookieFile = await ensureCookieFile();
    console.log('🧪 COOKIE DEBUG: Cookie file result:', cookieFile);

    if (cookieFile) {
      // Test reading the cookie file
      try {
        const cookieContent = await fs.readFile(cookieFile, 'utf8');
        console.log('🧪 COOKIE DEBUG: Cookie file exists, length:', cookieContent.length);

        // Test cookie extraction with cookies
        try {
          const { stdout, stderr } = await execAsync(
            `"${ytdlpPath}" -j --no-warnings --cookies "${cookieFile}" "${url}"`,
            {
              maxBuffer: 1024 * 1024 * 10,
              timeout: 30000
            }
          );

          return res.status(200).json({
            success: true,
            message: 'Cookie authentication successful',
            ytdlpPath,
            cookieFile,
            cookieFileExists: true,
            titleExtracted: JSON.parse(stdout).title || 'No title'
          });

        } catch (cookieError: any) {
          console.log('🧪 COOKIE DEBUG: Cookie extraction failed:', cookieError.message);

          return res.status(500).json({
            success: false,
            stage: 'cookie_extraction',
            error: cookieError.stderr || cookieError.message,
            ytdlpPath,
            cookieFile,
            cookieFileExists: true
          });
        }
      } catch (readError: any) {
        return res.status(500).json({
          success: false,
          stage: 'cookie_file_read',
          error: readError.message,
          ytdlpPath,
          cookieFile
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        stage: 'cookie_file_creation',
        error: 'Could not create cookie file',
        ytdlpPath,
        workingDirectory: process.cwd()
      });
    }

  } catch (error: any) {
    console.error('🧪 COOKIE DEBUG: General error:', error);
    return res.status(500).json({
      success: false,
      stage: 'general',
      error: error.message,
      workingDirectory: process.cwd()
    });
  }
}