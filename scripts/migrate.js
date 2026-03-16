#!/usr/bin/env node
/**
 * Run Prisma migrations. Loads .env from project root.
 * Run: npm run db:migrate
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendDir = path.join(root, 'backend');

if (!fs.existsSync(envPath)) {
  const examplePath = path.join(root, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('Created .env from .env.example');
  } else {
    console.error('Missing .env. Copy .env.example to .env and set DATABASE_URL.');
    process.exit(1);
  }
}

const envVars = { ...process.env };
fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });

execSync('npx prisma db push', {
  cwd: backendDir,
  stdio: 'inherit',
  env: envVars,
});
