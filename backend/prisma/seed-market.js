#!/usr/bin/env node
/**
 * Baseline market data only (assets, pairs, tickers, cryptos).
 * Run automatically from `npm run setup` at repo root. Idempotent.
 */
const { prisma, seedMarket } = require('./seed-lib');

(async () => {
  try {
    console.log('Applying baseline market data...');
    await seedMarket();
    console.log('Baseline market data complete.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
