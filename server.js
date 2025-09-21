#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting Next.js production server...');

// Start Next.js using npm start
const nextProcess = spawn('npm', ['start'], {
  stdio: 'inherit',
  env: process.env
});

// Handle process events
nextProcess.on('close', (code) => {
  console.log(`Next.js server process exited with code ${code}`);
  process.exit(code);
});

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  nextProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  nextProcess.kill('SIGINT');
});