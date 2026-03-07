const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting ChromaBrain...');

// Start Express backend
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Start Next.js frontend
const next = spawn('npx', ['next', 'start', '-p', '3003'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Handle shutdown
process.on('SIGTERM', () => {
  server.kill();
  next.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  server.kill();
  next.kill();
  process.exit(0);
});
