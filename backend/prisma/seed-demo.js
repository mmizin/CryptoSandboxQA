#!/usr/bin/env node
/**
 * Optional demo accounts (`demo@example.com`, `qa@example.com`) with balances.
 * Run: `npm run db:seed` from repo root. Safe to run multiple times.
 * If the DB has no market listings yet, baseline market data is applied first.
 */
const { prisma, seedMarket, seedDemo } = require('./seed-lib');

(async () => {
  try {
    const n = await prisma.crypto.count();
    if (n === 0) {
      console.log('No market listings yet; applying baseline market data...');
      await seedMarket();
    }
    console.log('Seeding demo accounts...');
    await seedDemo();
    console.log('Demo seed complete.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
