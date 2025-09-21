/**
 * Container Debug Endpoint
 * Shows exactly what's in the deployment container
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default function handler(req, res) {
  try {
    const debug = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        RENDER: process.env.RENDER || 'false'
      },
      filesystem: {},
      processes: {}
    };

    // Check working directory contents
    try {
      const files = fs.readdirSync(process.cwd());
      debug.filesystem.workingDirectory = files.map(file => {
        const filePath = path.join(process.cwd(), file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime
        };
      });
    } catch (err) {
      debug.filesystem.workingDirectoryError = err.message;
    }

    // Check for key files
    const keyFiles = ['server.js', 'index.js', 'package.json', 'render.yaml', '.next/standalone/server.js'];
    debug.filesystem.keyFiles = {};

    keyFiles.forEach(file => {
      const fullPath = path.join(process.cwd(), file);
      debug.filesystem.keyFiles[file] = {
        exists: fs.existsSync(fullPath),
        path: fullPath
      };

      if (debug.filesystem.keyFiles[file].exists) {
        try {
          const stats = fs.statSync(fullPath);
          debug.filesystem.keyFiles[file].stats = {
            size: stats.size,
            modified: stats.mtime,
            isExecutable: (stats.mode & 0o111) !== 0
          };
        } catch (err) {
          debug.filesystem.keyFiles[file].statsError = err.message;
        }
      }
    });

    // Check /app directory if different from cwd
    if (process.cwd() !== '/app') {
      try {
        if (fs.existsSync('/app')) {
          const appFiles = fs.readdirSync('/app');
          debug.filesystem.appDirectory = appFiles;
        }
      } catch (err) {
        debug.filesystem.appDirectoryError = err.message;
      }
    }

    // Check running processes
    try {
      const ps = execSync('ps aux', { encoding: 'utf8' });
      debug.processes.list = ps.split('\n').slice(0, 10); // First 10 processes
    } catch (err) {
      debug.processes.error = err.message;
    }

    // Check Next.js specific paths
    const nextPaths = [
      '.next/standalone/server.js',
      '.next/server.js',
      'node_modules/.bin/next'
    ];

    debug.nextjs = {};
    nextPaths.forEach(p => {
      debug.nextjs[p] = fs.existsSync(path.join(process.cwd(), p));
    });

    res.status(200).json({
      success: true,
      debug,
      message: 'Container debug information collected successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      message: 'Failed to collect debug information'
    });
  }
}