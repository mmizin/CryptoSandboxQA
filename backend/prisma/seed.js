#!/usr/bin/env node
/**
 * Prisma seed: creates demo users, wallets, and tickers for QA practice.
 * Run: npx prisma db seed (from backend/) or npm run db:seed (from root)
 */
const path = require('path');
const fs = require('fs');

// Load root .env (project has .env at root, not in backend/)
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    });
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_USERS = [
  { email: 'demo@example.com', password: 'password123', displayName: 'Demo User' },
  { email: 'qa@example.com', password: 'qa123', displayName: 'QA Tester' },
];

const TICKERS = [
  { symbol: 'BTC_USD', lastPrice: 50000, volume24h: 0 },
  { symbol: 'ETH_USD', lastPrice: 3000, volume24h: 0 },
];

const ASSETS = ['BTC', 'ETH', 'USD'];

async function main() {
  console.log('Seeding database...');

  // Create tickers first (no dependencies)
  for (const t of TICKERS) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      create: t,
      update: { lastPrice: t.lastPrice },
    });
  }
  console.log(`  → ${TICKERS.length} tickers`);

  // Create users and wallets
  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email.toLowerCase() },
      include: { wallets: true },
    });

    if (existing) {
      console.log(`  → User ${u.email} already exists, skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: {
        email: u.email.toLowerCase(),
        passwordHash,
        displayName: u.displayName,
      },
    });

    // Create wallets with starter balances for QA practice
    const balances = { BTC: 0.5, ETH: 5, USD: 10000 };
    for (const asset of ASSETS) {
      await prisma.wallet.create({
        data: {
          userId: user.id,
          asset,
          balance: balances[asset] ?? 0,
        },
      });
    }
    console.log(`  → User ${u.email} + wallets`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
