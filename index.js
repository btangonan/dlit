#!/usr/bin/env node

/**
 * EMERGENCY DEPLOYMENT BYPASS
 * Bulletproof entry point that works regardless of location/config
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚨 [EMERGENCY BYPASS] Starting deployment...');
console.log('📁 Working directory:', process.cwd());
console.log('📋 Node version:', process.version);
console.log('🔍 __dirname:', __dirname);

// List all files in current directory for diagnostics
console.log('📄 Files in working directory:');
try {
  const files = fs.readdirSync(process.cwd());
  files.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`  ${file} (${stats.isDirectory() ? 'DIR' : 'FILE'})`);
  });
} catch (err) {
  console.log('❌ Cannot list files:', err.message);
}

// Check for Next.js
const nextPath = path.join(process.cwd(), 'node_modules', '.bin', 'next');
const hasNext = fs.existsSync(nextPath);
console.log('🔍 Next.js available:', hasNext);

if (hasNext) {
  console.log('🚀 Starting Next.js directly...');
  const nextProcess = spawn('npx', ['next', 'start'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });

  nextProcess.on('close', (code) => {
    console.log(`📊 Next.js exited with code ${code}`);
    process.exit(code);
  });

  nextProcess.on('error', (err) => {
    console.error('❌ Next.js error:', err);
    process.exit(1);
  });
} else {
  console.log('❌ Next.js not found, trying npm start...');
  const npmProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });

  npmProcess.on('close', (code) => {
    console.log(`📊 npm start exited with code ${code}`);
    process.exit(code);
  });

  npmProcess.on('error', (err) => {
    console.error('❌ npm start error:', err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  process.exit(0);
});