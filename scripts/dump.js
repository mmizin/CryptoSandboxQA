#!/usr/bin/env node
/**
 * Dump PostgreSQL data to data/postgres-dump.sql (data-only, no schema).
 * Only creates dump if DB has data (users or wallets exist).
 * Run before db:reset to save state for later restore.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const dataDir = path.join(root, 'data');
const dumpPath = path.join(dataDir, 'postgres-dump.sql');

if (!fs.existsSync(envPath)) {
  console.error('No .env file. Run npm run setup first.');
  process.exit(1);
}

const envVars = { ...process.env };
fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
const dbUrl = envVars.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

// Parse connection params for pg_dump (format: postgresql://user:pass@host:port/dbname)
const url = new URL(dbUrl.replace(/^postgresql:/, 'https:'));
const db = url.pathname.slice(1) || 'cryptosandbox';
const user = url.username || 'postgres';
const password = url.password || 'postgres';

// Check if DB has data (skip dump if empty to avoid overwriting with empty state)
try {
  const countResult = execSync(
    'docker exec cryptosandbox-postgres psql -U postgres -d cryptosandbox -t -A -c "SELECT COALESCE((SELECT COUNT(*) FROM users), 0) + COALESCE((SELECT COUNT(*) FROM wallets), 0)"',
    { encoding: 'utf8', env: { ...envVars, PGPASSWORD: password } }
  ).trim();
  const total = parseInt(countResult, 10) || 0;
  if (total === 0) {
    console.log('Database is empty. Skipping dump (run db:seed first to create demo data).');
    process.exit(0);
  }
} catch (e) {
  const err = (e.stderr || e.message || '').toString();
  if (err.includes('relation') && err.includes('does not exist')) {
    console.log('Schema not initialized. Skipping dump (run npm run setup first).');
    process.exit(0);
  }
  console.error('Could not check DB. Is Postgres running? Run: npm run db:up');
  process.exit(1);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const pgDumpCmd = [
  'docker',
  'exec',
  'cryptosandbox-postgres',
  'pg_dump',
  '-U', user,
  '-d', db,
  '--data-only',
  '--no-owner',
  '--no-privileges',
].join(' ');

try {
  execSync(pgDumpCmd, {
    stdio: ['pipe', fs.openSync(dumpPath, 'w'), 'pipe'],
    env: { ...envVars, PGPASSWORD: password },
  });
  console.log(`Dump saved to ${dumpPath}`);
} catch (e) {
  console.error('Dump failed. Is Postgres container running? (npm run db:up)');
  process.exit(1);
}
