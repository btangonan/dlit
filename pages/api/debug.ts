import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const { stdout } = await execAsync(`"${testPath}" --version`);
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
    const { stdout } = await execAsync('python3 --version');
    debugInfo.python = { status: 'available', version: stdout.trim() };
    console.log(`✅ DEBUG: Python available: ${stdout.trim()}`);
  } catch (error: any) {
    debugInfo.python = { status: 'failed', error: error.message };
    console.log(`❌ DEBUG: Python not available: ${error.message}`);
  }

  try {
    const { stdout } = await execAsync('pip --version');
    debugInfo.pip = { status: 'available', version: stdout.trim() };
    console.log(`✅ DEBUG: Pip available: ${stdout.trim()}`);
  } catch (error: any) {
    debugInfo.pip = { status: 'failed', error: error.message };
    console.log(`❌ DEBUG: Pip not available: ${error.message}`);
  }

  // Test basic network connectivity
  try {
    const { stdout } = await execAsync('curl -s --head https://www.youtube.com');
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
  console.log('📊 DEBUG: Results:', JSON.stringify(debugInfo, null, 2));

  res.status(200).json(debugInfo);
}