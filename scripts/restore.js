#!/usr/bin/env node
/**
 * Restore PostgreSQL data from data/postgres-dump.sql.
 * Only runs if the dump file exists.
 * Used by setup or run manually after db:reset.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const dumpPath = path.join(root, 'data', 'postgres-dump.sql');

if (!fs.existsSync(dumpPath)) {
  console.log('No dump file at data/postgres-dump.sql. Skipping restore.');
  process.exit(0);
}

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

const url = new URL(dbUrl.replace(/^postgresql:/, 'https:'));
const db = url.pathname.slice(1) || 'cryptosandbox';
const user = url.username || 'postgres';
const password = url.password || 'postgres';

try {
  const dumpContent = fs.readFileSync(dumpPath, 'utf8');
  execSync('docker exec -i cryptosandbox-postgres psql -U ' + user + ' -d ' + db, {
    input: dumpContent,
    encoding: 'utf8',
    env: { ...envVars, PGPASSWORD: password },
  });
  console.log('Restore complete.');
} catch (e) {
  console.error('Restore failed. Is Postgres container running? (npm run db:up)');
  process.exit(1);
}
