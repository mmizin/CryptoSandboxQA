#!/usr/bin/env node
/**
 * Stop the database container. Prompts to create a dump first if DB has data.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dumpScript = path.join(root, 'scripts', 'dump.js');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve((answer || '').trim().toLowerCase());
    });
  });
}

async function main() {
  let answer = 'n';
  if (process.stdin.isTTY) {
    answer = await question('Create a DB dump before stopping? (y/n): ');
  }
  rl.close();

  if (answer === 'y' || answer === 'yes') {
    try {
      execSync(`node "${dumpScript}"`, { stdio: 'inherit', cwd: root });
    } catch (e) {
      console.error('Dump failed. Proceeding with db:down anyway.');
    }
  }

  execSync('docker compose down', { stdio: 'inherit', cwd: root });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
