#!/usr/bin/env node
/**
 * Start PostgreSQL container. If the full stack is already running, warns the user.
 */
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function isStackRunning() {
  try {
    const out = execSync('docker ps -q -f name=cryptosandbox-backend', {
      cwd: root,
      encoding: 'utf8',
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function main() {
  if (isStackRunning()) {
    console.warn('\n⚠️  Full stack is already running (backend container detected).');
    console.warn('   db:up will only manage PostgreSQL. To stop everything, use: npm run stack:down\n');
  }

  execSync('docker compose up -d', { stdio: 'inherit', cwd: root });
}

main();
