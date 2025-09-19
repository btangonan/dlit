import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { safeExecute } from '../../lib/safeExec';
import { protectDebugEndpoint, sanitizeDebugOutput } from '../../lib/debugAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Protect debug endpoint in production
  if (!protectDebugEndpoint(req, res)) {
    return;
  }

  console.log('🔍 DEBUG: Starting comprehensive environment check...');

  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd()
    },
    binaryTests: {},
    errors: []
  };

  // Test multiple yt-dlp installation paths
  const testPaths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
    path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp')
  ];

  console.log('🔍 DEBUG: Testing binary paths...');

  for (const testPath of testPaths) {
    try {
      const { stdout } = await safeExecute(testPath, ['--version']);
      debugInfo.binaryTests[testPath] = {
        status: 'success',
        version: stdout.trim()
      };
      console.log(`✅ DEBUG: Found yt-dlp at ${testPath}: ${stdout.trim()}`);
    } catch (error: any) {
      debugInfo.binaryTests[testPath] = {
        status: 'failed',
        error: error.message
      };
      console.log(`❌ DEBUG: Failed at ${testPath}: ${error.message}`);
    }
  }

  // Test Python/pip availability
  try {
    const { stdout } = await safeExecute('python3', ['--version']);
    debugInfo.python = { status: 'available', version: stdout.trim() };
    console.log(`✅ DEBUG: Python available: ${stdout.trim()}`);
  } catch (error: any) {
    debugInfo.python = { status: 'failed', error: error.message };
    console.log(`❌ DEBUG: Python not available: ${error.message}`);
  }

  try {
    const { stdout } = await safeExecute('pip', ['--version']);
    debugInfo.pip = { status: 'available', version: stdout.trim() };
    console.log(`✅ DEBUG: Pip available: ${stdout.trim()}`);
  } catch (error: any) {
    debugInfo.pip = { status: 'failed', error: error.message };
    console.log(`❌ DEBUG: Pip not available: ${error.message}`);
  }

  // Test basic network connectivity
  try {
    const { stdout } = await safeExecute('curl', ['-s', '--head', 'https://www.youtube.com']);
    debugInfo.network = { status: 'success', response: 'YouTube accessible' };
    console.log('✅ DEBUG: Network connectivity to YouTube successful');
  } catch (error: any) {
    debugInfo.network = { status: 'failed', error: error.message };
    console.log(`❌ DEBUG: Network test failed: ${error.message}`);
  }

  // Memory info
  const memUsage = process.memoryUsage();
  debugInfo.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  };

  console.log('🔍 DEBUG: Complete environment check finished');

  // Sanitize debug output to remove sensitive information
  const sanitizedDebugInfo = sanitizeDebugOutput(debugInfo);
  console.log('📊 DEBUG: Results:', JSON.stringify(sanitizedDebugInfo, null, 2));

  res.status(200).json(sanitizedDebugInfo);
}