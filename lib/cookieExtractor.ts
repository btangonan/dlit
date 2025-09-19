import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
}

export class BrowserCookieExtractor {
  private cookieOutputPath: string;

  constructor() {
    // Create a temporary directory for cookie files
    const tempDir = path.join(os.tmpdir(), 'video-downloader-cookies');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    this.cookieOutputPath = path.join(tempDir, 'vimeo_cookies.txt');
  }

  /**
   * Extract cookies from all available browsers for Vimeo
   * Returns path to Netscape-format cookie file, or null if no cookies found
   */
  async extractVimeoCookies(): Promise<string | null> {
    console.log('🍪 Extracting Vimeo cookies from browsers...');

    try {
      // Try multiple extraction methods in order of preference
      const extractors = [
        () => this.extractChromeCookies(),
        () => this.extractSafariCookies(),
        () => this.extractFirefoxCookies(),
        () => this.extractEdgeCookies()
      ];

      for (const extractor of extractors) {
        try {
          const cookies = await extractor();
          if (cookies && cookies.length > 0) {
            await this.writeCookiesToFile(cookies);
            console.log(`✅ Found ${cookies.length} Vimeo cookies`);
            return this.cookieOutputPath;
          }
        } catch (error) {
          // Continue to next extractor
          console.log(`⚠️ Cookie extraction failed for one browser: ${error.message}`);
        }
      }

      console.log('❌ No Vimeo cookies found in any browser');
      return null;
    } catch (error) {
      console.error('🚫 Cookie extraction error:', error.message);
      return null;
    }
  }

  /**
   * Extract cookies from Chrome
   */
  private async extractChromeCookies(): Promise<Cookie[]> {
    const chromeDbPath = path.join(
      os.homedir(),
      'Library/Application Support/Google/Chrome/Default/Cookies'
    );

    if (!fs.existsSync(chromeDbPath)) {
      throw new Error('Chrome cookies database not found');
    }

    // Copy the database to avoid locking issues
    const tempDbPath = path.join(os.tmpdir(), 'chrome_cookies_temp.db');
    fs.copyFileSync(chromeDbPath, tempDbPath);

    try {
      // Query Chrome's SQLite database
      const query = `
        SELECT name, value, host_key, path, is_secure, is_httponly, expires_utc
        FROM cookies
        WHERE host_key LIKE '%vimeo.com%'
        AND expires_utc > ${Date.now() * 1000}
      `;

      const { stdout } = await execAsync(`sqlite3 "${tempDbPath}" "${query}"`);
      const lines = stdout.trim().split('\n').filter(line => line);

      return lines.map(line => {
        const [name, value, domain, path, secure, httpOnly, expires] = line.split('|');
        return {
          name,
          value,
          domain: domain.startsWith('.') ? domain : `.${domain}`,
          path: path || '/',
          secure: secure === '1',
          httpOnly: httpOnly === '1',
          expirationDate: expires ? parseInt(expires) / 1000000 : undefined
        };
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }
  }

  /**
   * Extract cookies from Safari
   */
  private async extractSafariCookies(): Promise<Cookie[]> {
    const safariDbPath = path.join(
      os.homedir(),
      'Library/Cookies/Cookies.binarycookies'
    );

    if (!fs.existsSync(safariDbPath)) {
      throw new Error('Safari cookies not found');
    }

    // Safari uses a binary format, need to use a different approach
    // Try using the system's cookie store via JavaScript
    try {
      const { stdout } = await execAsync(`
        python3 -c "
import sqlite3
import os
from urllib.parse import urlparse

db_path = os.path.expanduser('~/Library/Application Support/com.apple.Safari/Cookies.binarycookies')
if not os.path.exists(db_path):
    exit(1)

# Safari cookies are in binary format, this is a simplified extraction
print('Safari cookie extraction not yet implemented')
"
      `);

      return []; // Safari extraction is complex due to binary format
    } catch (error) {
      throw new Error('Safari cookie extraction failed');
    }
  }

  /**
   * Extract cookies from Firefox
   */
  private async extractFirefoxCookies(): Promise<Cookie[]> {
    const firefoxDir = path.join(os.homedir(), 'Library/Application Support/Firefox/Profiles');

    if (!fs.existsSync(firefoxDir)) {
      throw new Error('Firefox profiles directory not found');
    }

    const profiles = fs.readdirSync(firefoxDir).filter(dir => dir.includes('.default'));
    if (profiles.length === 0) {
      throw new Error('No Firefox default profile found');
    }

    const cookieDbPath = path.join(firefoxDir, profiles[0], 'cookies.sqlite');
    if (!fs.existsSync(cookieDbPath)) {
      throw new Error('Firefox cookies database not found');
    }

    const tempDbPath = path.join(os.tmpdir(), 'firefox_cookies_temp.db');
    fs.copyFileSync(cookieDbPath, tempDbPath);

    try {
      const query = `
        SELECT name, value, host, path, isSecure, isHttpOnly, expiry
        FROM moz_cookies
        WHERE host LIKE '%vimeo.com%'
        AND expiry > ${Math.floor(Date.now() / 1000)}
      `;

      const { stdout } = await execAsync(`sqlite3 "${tempDbPath}" "${query}"`);
      const lines = stdout.trim().split('\n').filter(line => line);

      return lines.map(line => {
        const [name, value, domain, path, secure, httpOnly, expires] = line.split('|');
        return {
          name,
          value,
          domain: domain.startsWith('.') ? domain : `.${domain}`,
          path: path || '/',
          secure: secure === '1',
          httpOnly: httpOnly === '1',
          expirationDate: expires ? parseInt(expires) : undefined
        };
      });
    } finally {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }
  }

  /**
   * Extract cookies from Microsoft Edge
   */
  private async extractEdgeCookies(): Promise<Cookie[]> {
    const edgeDbPath = path.join(
      os.homedir(),
      'Library/Application Support/Microsoft Edge/Default/Cookies'
    );

    if (!fs.existsSync(edgeDbPath)) {
      throw new Error('Edge cookies database not found');
    }

    // Edge uses the same format as Chrome
    const tempDbPath = path.join(os.tmpdir(), 'edge_cookies_temp.db');
    fs.copyFileSync(edgeDbPath, tempDbPath);

    try {
      const query = `
        SELECT name, value, host_key, path, is_secure, is_httponly, expires_utc
        FROM cookies
        WHERE host_key LIKE '%vimeo.com%'
        AND expires_utc > ${Date.now() * 1000}
      `;

      const { stdout } = await execAsync(`sqlite3 "${tempDbPath}" "${query}"`);
      const lines = stdout.trim().split('\n').filter(line => line);

      return lines.map(line => {
        const [name, value, domain, path, secure, httpOnly, expires] = line.split('|');
        return {
          name,
          value,
          domain: domain.startsWith('.') ? domain : `.${domain}`,
          path: path || '/',
          secure: secure === '1',
          httpOnly: httpOnly === '1',
          expirationDate: expires ? parseInt(expires) / 1000000 : undefined
        };
      });
    } finally {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }
  }

  /**
   * Write cookies to Netscape format file for yt-dlp
   */
  private async writeCookiesToFile(cookies: Cookie[]): Promise<void> {
    const netscapeHeader = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\n';

    const cookieLines = cookies.map(cookie => {
      // Netscape format: domain\tincludeDomain\tpath\tsecure\texpires\tname\tvalue
      const domain = cookie.domain;
      const includeDomain = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const path = cookie.path;
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expires = cookie.expirationDate ? Math.floor(cookie.expirationDate).toString() : '0';
      const name = cookie.name;
      const value = cookie.value;

      return `${domain}\t${includeDomain}\t${path}\t${secure}\t${expires}\t${name}\t${value}`;
    });

    const content = netscapeHeader + cookieLines.join('\n') + '\n';
    fs.writeFileSync(this.cookieOutputPath, content, 'utf8');
  }

  /**
   * Clean up temporary cookie files
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.cookieOutputPath)) {
        fs.unlinkSync(this.cookieOutputPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if the extracted cookie file exists and is valid
   */
  hasCookies(): boolean {
    return fs.existsSync(this.cookieOutputPath);
  }

  /**
   * Get the path to the cookie file
   */
  getCookieFilePath(): string {
    return this.cookieOutputPath;
  }
}

export default BrowserCookieExtractor;