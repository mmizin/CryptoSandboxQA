#!/usr/bin/env node
/**
 * One-time setup: ensures .env exists and runs DB migrations.
 * Run after: git clone, npm install, docker compose up -d
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('Created .env from .env.example');
} else if (fs.existsSync(envPath)) {
  console.log('.env already exists');
} else {
  console.error('Missing .env.example');
  process.exit(1);
}

// Load .env for Prisma (runs from backend/, so we must pass vars explicitly)
const envVars = { ...process.env };
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});

// Wait for Postgres to be ready (docker compose may have just started)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const backendDir = path.join(root, 'backend');
const maxRetries = 15;
for (let i = 0; i < maxRetries; i++) {
  try {
    execSync('npx prisma db push', {
      cwd: backendDir,
      stdio: 'inherit',
      env: envVars,
    });
    break;
  } catch (e) {
    const msg = (e.stderr || e.stdout || '').toString();
    if (i === maxRetries - 1) {
      console.error('\nPostgreSQL may not be ready. Run: docker compose up -d and try again.');
      process.exit(1);
    }
    if (msg.includes('Can\'t reach') || msg.includes('Connection refused') || msg.includes('P1001')) {
      process.stdout.write('Waiting for PostgreSQL...\n');
      await wait(3000);
    } else {
      throw e;
    }
  }
}

process.chdir(backendDir);
execSync('npx prisma generate', { stdio: 'inherit', env: envVars });

// Restore from dump if present (e.g. after db:reset when dump was created earlier)
const dumpPath = path.join(root, 'data', 'postgres-dump.sql');
if (fs.existsSync(dumpPath)) {
  console.log('\nRestoring from data/postgres-dump.sql...');
  const restoreScript = path.join(root, 'scripts', 'restore.js');
  execSync(`node "${restoreScript}"`, { stdio: 'inherit', cwd: root, env: envVars });
}

console.log('\nSetup complete! Run: npm run dev');
}
main().catch((e) => { console.error(e); process.exit(1); });
