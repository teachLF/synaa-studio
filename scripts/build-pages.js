// Cross-platform GitHub Pages static export builder.
// Usage: node scripts/build-pages.js
process.env.BUILD_PAGES = 'true';

const { spawnSync } = require('child_process');
const path = require('path');

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status === null ? 1 : result.status);
