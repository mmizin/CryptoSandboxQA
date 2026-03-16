#!/usr/bin/env node
/**
 * Prisma seed: creates assets, trading pairs, tickers, demo users, user_balances, and cryptos.
 * Run: npx prisma db seed (from backend/) or npm run db:seed (from root)
 */
const path = require('path');
const fs = require('fs');

// Load root .env
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

const ASSET_DEFS = [
  { symbol: 'USD', name: 'US Dollar', assetType: 'fiat', walletAddress: null },
  { symbol: 'EUR', name: 'Euro', assetType: 'fiat', walletAddress: null },
  { symbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { symbol: 'ETH', name: 'Ethereum', assetType: 'crypto', walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
];

const TRADING_PAIRS = [
  { symbol: 'BTC_USD', baseSymbol: 'BTC', quoteSymbol: 'USD' },
  { symbol: 'ETH_USD', baseSymbol: 'ETH', quoteSymbol: 'USD' },
];

const DEMO_BALANCES = { BTC: 0.5, ETH: 5, USD: 10000 };

// 100+ cryptocurrencies for Markets pages
const CRYPTOS = [
  { name: 'Bitcoin', symbol: 'BTC', price: 97500, change24h: 2.34, volume24h: 48500000000, popular: true },
  { name: 'Ethereum', symbol: 'ETH', price: 3650, change24h: -1.2, volume24h: 18200000000, popular: true },
  { name: 'Tether', symbol: 'USDT', price: 1, change24h: 0.01, volume24h: 92000000000, popular: true },
  { name: 'BNB', symbol: 'BNB', price: 715, change24h: 0.85, volume24h: 3200000000, popular: true },
  { name: 'Solana', symbol: 'SOL', price: 235, change24h: 4.1, volume24h: 4100000000, popular: true },
  { name: 'XRP', symbol: 'XRP', price: 2.45, change24h: -0.5, volume24h: 2800000000, popular: true },
  { name: 'USDC', symbol: 'USDC', price: 1, change24h: 0, volume24h: 8500000000, popular: false },
  { name: 'Cardano', symbol: 'ADA', price: 1.12, change24h: 1.8, volume24h: 1200000000, popular: true },
  { name: 'Dogecoin', symbol: 'DOGE', price: 0.38, change24h: 3.2, volume24h: 2100000000, popular: true },
  { name: 'Avalanche', symbol: 'AVAX', price: 42, change24h: -2.1, volume24h: 680000000, popular: true },
  { name: 'TRON', symbol: 'TRX', price: 0.22, change24h: 0.9, volume24h: 950000000, popular: false },
  { name: 'Chainlink', symbol: 'LINK', price: 18.5, change24h: 2.3, volume24h: 520000000, popular: true },
  { name: 'Polkadot', symbol: 'DOT', price: 7.8, change24h: -1.5, volume24h: 380000000, popular: true },
  { name: 'Polygon', symbol: 'MATIC', price: 0.52, change24h: 1.2, volume24h: 420000000, popular: true },
  { name: 'Shiba Inu', symbol: 'SHIB', price: 0.000025, change24h: 5.1, volume24h: 890000000, popular: true },
  { name: 'Litecoin', symbol: 'LTC', price: 95, change24h: 0.6, volume24h: 650000000, popular: true },
  { name: 'Dai', symbol: 'DAI', price: 1, change24h: 0.02, volume24h: 580000000, popular: false },
  { name: 'Uniswap', symbol: 'UNI', price: 12.5, change24h: -0.8, volume24h: 290000000, popular: false },
  { name: 'Bitcoin Cash', symbol: 'BCH', price: 485, change24h: 1.4, volume24h: 410000000, popular: false },
  { name: 'Stellar', symbol: 'XLM', price: 0.48, change24h: 0.3, volume24h: 180000000, popular: false },
  { name: 'Cosmos', symbol: 'ATOM', price: 9.2, change24h: -1.1, volume24h: 250000000, popular: false },
  { name: 'Filecoin', symbol: 'FIL', price: 6.8, change24h: 2.5, volume24h: 190000000, popular: false },
  { name: 'Arbitrum', symbol: 'ARB', price: 1.15, change24h: -0.4, volume24h: 420000000, popular: false },
  { name: 'Optimism', symbol: 'OP', price: 2.45, change24h: 1.9, volume24h: 280000000, popular: false },
  { name: 'Internet Computer', symbol: 'ICP', price: 14.2, change24h: 3.2, volume24h: 120000000, popular: false },
  { name: 'Hedera', symbol: 'HBAR', price: 0.38, change24h: 0.7, volume24h: 95000000, popular: false },
  { name: 'VeChain', symbol: 'VET', price: 0.042, change24h: -0.2, volume24h: 88000000, popular: false },
  { name: 'NEAR Protocol', symbol: 'NEAR', price: 6.5, change24h: 2.8, volume24h: 210000000, popular: false },
  { name: 'Aptos', symbol: 'APT', price: 11.2, change24h: 1.5, volume24h: 180000000, popular: false },
  { name: 'Lido DAO', symbol: 'LDO', price: 2.3, change24h: -1.2, volume24h: 85000000, popular: false },
  { name: 'Sui', symbol: 'SUI', price: 3.85, change24h: 4.2, volume24h: 520000000, popular: false },
  { name: 'Render', symbol: 'RENDER', price: 8.9, change24h: -0.9, volume24h: 95000000, popular: false },
  { name: 'The Graph', symbol: 'GRT', price: 0.28, change24h: 1.3, volume24h: 72000000, popular: false },
  { name: 'Aave', symbol: 'AAVE', price: 385, change24h: -0.5, volume24h: 125000000, popular: false },
  { name: 'Algorand', symbol: 'ALGO', price: 0.35, change24h: 0.8, volume24h: 68000000, popular: false },
  { name: 'Injective', symbol: 'INJ', price: 28.5, change24h: 3.5, volume24h: 95000000, popular: false },
  { name: 'Fantom', symbol: 'FTM', price: 0.65, change24h: 2.1, volume24h: 78000000, popular: false },
  { name: 'Decentraland', symbol: 'MANA', price: 0.52, change24h: -1.8, volume24h: 85000000, popular: false },
  { name: 'Axie Infinity', symbol: 'AXS', price: 8.2, change24h: 0.4, volume24h: 42000000, popular: false },
  { name: 'Theta Network', symbol: 'THETA', price: 2.1, change24h: -0.3, volume24h: 35000000, popular: false },
  { name: 'Ethereum Classic', symbol: 'ETC', price: 28, change24h: 0.9, volume24h: 280000000, popular: false },
  { name: 'EOS', symbol: 'EOS', price: 0.88, change24h: -0.6, volume24h: 65000000, popular: false },
  { name: 'Tezos', symbol: 'XTZ', price: 1.15, change24h: 0.2, volume24h: 28000000, popular: false },
  { name: 'Monero', symbol: 'XMR', price: 165, change24h: 0.5, volume24h: 95000000, popular: false },
  { name: 'Theta Fuel', symbol: 'TFUEL', price: 0.065, change24h: 2.2, volume24h: 22000000, popular: false },
  { name: 'Flow', symbol: 'FLOW', price: 0.92, change24h: -1.1, volume24h: 45000000, popular: false },
  { name: 'ApeCoin', symbol: 'APE', price: 1.95, change24h: 1.4, volume24h: 85000000, popular: false },
  { name: 'Fetch.ai', symbol: 'FET', price: 1.85, change24h: 5.2, volume24h: 125000000, popular: false },
  { name: 'Sandbox', symbol: 'SAND', price: 0.48, change24h: -0.8, volume24h: 65000000, popular: false },
  { name: 'Elrond', symbol: 'EGLD', price: 52, change24h: 1.2, volume24h: 38000000, popular: false },
  { name: 'Quant', symbol: 'QNT', price: 95, change24h: -0.4, volume24h: 22000000, popular: false },
  { name: 'eCash', symbol: 'XEC', price: 0.000045, change24h: 0.6, volume24h: 28000000, popular: false },
  { name: 'Maker', symbol: 'MKR', price: 1850, change24h: 1.8, volume24h: 85000000, popular: false },
  { name: 'Kusama', symbol: 'KSM', price: 38, change24h: -1.5, volume24h: 18000000, popular: false },
  { name: 'Curve DAO', symbol: 'CRV', price: 0.42, change24h: 0.9, volume24h: 45000000, popular: false },
  { name: 'PancakeSwap', symbol: 'CAKE', price: 2.85, change24h: 1.2, volume24h: 95000000, popular: false },
  { name: '1inch', symbol: '1INCH', price: 0.45, change24h: -0.3, volume24h: 35000000, popular: false },
  { name: 'dYdX', symbol: 'DYDX', price: 1.95, change24h: 2.1, volume24h: 42000000, popular: false },
  { name: 'GMX', symbol: 'GMX', price: 28.5, change24h: -0.8, volume24h: 22000000, popular: false },
  { name: 'Stacks', symbol: 'STX', price: 2.45, change24h: 4.5, volume24h: 125000000, popular: false },
  { name: 'Wrapped Bitcoin', symbol: 'WBTC', price: 97500, change24h: 2.3, volume24h: 580000000, popular: false },
  { name: 'Conflux', symbol: 'CFX', price: 0.28, change24h: 3.2, volume24h: 55000000, popular: false },
  { name: 'MultiversX', symbol: 'MX', price: 2.85, change24h: 1.2, volume24h: 38000000, popular: false },
  { name: 'Storj', symbol: 'STORJ', price: 0.85, change24h: -0.5, volume24h: 25000000, popular: false },
  { name: 'Ocean Protocol', symbol: 'OCEAN', price: 0.65, change24h: 1.8, volume24h: 18000000, popular: false },
  { name: 'Enjin Coin', symbol: 'ENJ', price: 0.32, change24h: -0.2, volume24h: 42000000, popular: false },
  { name: 'Zilliqa', symbol: 'ZIL', price: 0.025, change24h: 0.4, volume24h: 35000000, popular: false },
  { name: 'Waves', symbol: 'WAVES', price: 2.85, change24h: -1.2, volume24h: 22000000, popular: false },
  { name: 'GateToken', symbol: 'GT', price: 6.5, change24h: 0.3, volume24h: 15000000, popular: false },
  { name: 'Loopring', symbol: 'LRC', price: 0.28, change24h: 1.5, volume24h: 28000000, popular: false },
  { name: 'Orca', symbol: 'ORCA', price: 1.25, change24h: -0.6, volume24h: 12000000, popular: false },
  { name: 'Serum', symbol: 'SRM', price: 0.055, change24h: 0.8, volume24h: 8000000, popular: false },
  { name: 'Reserve Rights', symbol: 'RSR', price: 0.0055, change24h: 2.5, volume24h: 25000000, popular: false },
  { name: 'Klaytn', symbol: 'KLAY', price: 0.22, change24h: -0.4, volume24h: 35000000, popular: false },
  { name: 'Compound', symbol: 'COMP', price: 58, change24h: 0.9, volume24h: 45000000, popular: false },
  { name: 'Synthetix', symbol: 'SNX', price: 2.85, change24h: -1.1, volume24h: 42000000, popular: false },
  { name: 'TrueUSD', symbol: 'TUSD', price: 1, change24h: 0.01, volume24h: 280000000, popular: false },
  { name: 'Huobi Token', symbol: 'HT', price: 3.25, change24h: 0.5, volume24h: 22000000, popular: false },
  { name: 'Zcash', symbol: 'ZEC', price: 28, change24h: -0.3, volume24h: 35000000, popular: false },
  { name: 'Dash', symbol: 'DASH', price: 32, change24h: 0.7, volume24h: 28000000, popular: false },
  { name: 'IOTA', symbol: 'IOTA', price: 0.32, change24h: 1.2, volume24h: 25000000, popular: false },
  { name: 'Bitcoin SV', symbol: 'BSV', price: 45, change24h: -0.5, volume24h: 35000000, popular: false },
  { name: 'NEO', symbol: 'NEO', price: 12.5, change24h: 0.3, volume24h: 18000000, popular: false },
  { name: 'Kava', symbol: 'KAVA', price: 0.65, change24h: -0.8, volume24h: 22000000, popular: false },
  { name: 'Terra', symbol: 'LUNA', price: 0.85, change24h: 2.1, volume24h: 95000000, popular: false },
  { name: 'PAX Gold', symbol: 'PAXG', price: 2650, change24h: 0.2, volume24h: 25000000, popular: false },
  { name: 'Arweave', symbol: 'AR', price: 28.5, change24h: 3.5, volume24h: 45000000, popular: false },
  { name: 'THORChain', symbol: 'RUNE', price: 5.2, change24h: -1.2, volume24h: 55000000, popular: false },
  { name: 'Celo', symbol: 'CELO', price: 0.95, change24h: 0.6, volume24h: 22000000, popular: false },
  { name: 'Chiliz', symbol: 'CHZ', price: 0.12, change24h: 1.5, volume24h: 65000000, popular: false },
  { name: 'Basic Attention', symbol: 'BAT', price: 0.28, change24h: -0.4, volume24h: 28000000, popular: false },
  { name: 'Holo', symbol: 'HOT', price: 0.0025, change24h: 2.8, volume24h: 35000000, popular: false },
  { name: 'Helium', symbol: 'HNT', price: 4.2, change24h: 1.2, volume24h: 25000000, popular: false },
  { name: 'Kadena', symbol: 'KDA', price: 0.95, change24h: -0.5, volume24h: 18000000, popular: false },
  { name: 'Harmony', symbol: 'ONE', price: 0.015, change24h: 3.2, volume24h: 28000000, popular: false },
  { name: 'ICON', symbol: 'ICX', price: 0.28, change24h: 0.8, volume24h: 15000000, popular: false },
  { name: 'Qtum', symbol: 'QTUM', price: 3.85, change24h: -0.3, volume24h: 22000000, popular: false },
  { name: 'NEM', symbol: 'XEM', price: 0.042, change24h: 0.5, volume24h: 18000000, popular: false },
  { name: 'Ravencoin', symbol: 'RVN', price: 0.025, change24h: 1.8, volume24h: 25000000, popular: false },
  { name: 'Siacoin', symbol: 'SC', price: 0.0085, change24h: -0.6, volume24h: 12000000, popular: false },
  { name: 'Decred', symbol: 'DCR', price: 22, change24h: 0.4, volume24h: 8000000, popular: false },
  { name: 'DigiByte', symbol: 'DGB', price: 0.0085, change24h: 1.2, volume24h: 15000000, popular: false },
  { name: 'Nano', symbol: 'XNO', price: 1.25, change24h: -0.8, volume24h: 12000000, popular: false },
  { name: 'Rocket Pool ETH', symbol: 'RETH', price: 3950, change24h: -0.3, volume24h: 35000000, popular: false },
  { name: 'Band Protocol', symbol: 'BAND', price: 1.85, change24h: 0.9, volume24h: 12000000, popular: false },
  { name: 'Orchid', symbol: 'OXT', price: 0.085, change24h: -0.2, volume24h: 8000000, popular: false },
  { name: 'Audius', symbol: 'AUDIO', price: 0.22, change24h: 2.1, volume24h: 22000000, popular: false },
  { name: 'Cartesi', symbol: 'CTSI', price: 0.28, change24h: 0.5, volume24h: 12000000, popular: false },
  { name: 'Skale', symbol: 'SKL', price: 0.058, change24h: -0.4, volume24h: 15000000, popular: false },
  { name: 'Casper', symbol: 'CSPR', price: 0.032, change24h: 1.5, volume24h: 22000000, popular: false },
  { name: 'Secret', symbol: 'SCRT', price: 0.42, change24h: 0.3, volume24h: 8000000, popular: false },
  { name: 'Oasis Network', symbol: 'ROSE', price: 0.095, change24h: -0.6, volume24h: 28000000, popular: false },
  { name: 'Moonbeam', symbol: 'GLMR', price: 0.28, change24h: 1.2, volume24h: 18000000, popular: false },
  { name: 'Astar', symbol: 'ASTR', price: 0.065, change24h: 0.8, volume24h: 22000000, popular: false },
  { name: 'Syscoin', symbol: 'SYS', price: 0.22, change24h: -0.3, volume24h: 8000000, popular: false },
  { name: 'Ankr', symbol: 'ANKR', price: 0.042, change24h: 1.8, volume24h: 35000000, popular: false },
  { name: 'Gala', symbol: 'GALA', price: 0.032, change24h: 2.5, volume24h: 55000000, popular: false },
  { name: 'Immutable X', symbol: 'IMX', price: 1.45, change24h: -0.5, volume24h: 42000000, popular: false },
  { name: 'Lisk', symbol: 'LSK', price: 1.85, change24h: 0.4, volume24h: 12000000, popular: false },
  { name: 'WOO Network', symbol: 'WOO', price: 0.32, change24h: 1.2, volume24h: 25000000, popular: false },
  { name: 'Radix', symbol: 'XRD', price: 0.095, change24h: -0.8, volume24h: 18000000, popular: false },
  { name: 'Moonriver', symbol: 'MOVR', price: 12.5, change24h: 0.9, volume24h: 8000000, popular: false },
  { name: 'Telcoin', symbol: 'TEL', price: 0.0012, change24h: 3.5, volume24h: 22000000, popular: false },
  { name: 'Convex', symbol: 'CVX', price: 3.25, change24h: -0.6, volume24h: 15000000, popular: false },
  { name: 'Frax', symbol: 'FRAX', price: 1, change24h: 0.01, volume24h: 85000000, popular: false },
  { name: 'Liquity', symbol: 'LQTY', price: 1.25, change24h: 0.5, volume24h: 12000000, popular: false },
  { name: 'Rocket Pool', symbol: 'RPL', price: 22.5, change24h: -1.2, volume24h: 8000000, popular: false },
  { name: 'Blur', symbol: 'BLUR', price: 0.28, change24h: 2.8, volume24h: 45000000, popular: false },
  { name: 'Pepe', symbol: 'PEPE', price: 0.000012, change24h: 8.5, volume24h: 520000000, popular: true },
  { name: 'Bonk', symbol: 'BONK', price: 0.000032, change24h: 6.2, volume24h: 280000000, popular: true },
  { name: 'Worldcoin', symbol: 'WLD', price: 4.85, change24h: 3.5, volume24h: 380000000, popular: true },
  { name: 'Celestia', symbol: 'TIA', price: 9.5, change24h: 2.1, volume24h: 180000000, popular: false },
  { name: 'Jupiter', symbol: 'JUP', price: 0.95, change24h: -0.8, volume24h: 220000000, popular: false },
  { name: 'Sei', symbol: 'SEI', price: 0.45, change24h: 4.2, volume24h: 280000000, popular: false },
  { name: 'Wormhole', symbol: 'W', price: 0.65, change24h: 1.5, volume24h: 125000000, popular: false },
  { name: 'Starknet', symbol: 'STRK', price: 0.95, change24h: -1.2, volume24h: 95000000, popular: false },
  { name: 'Flare', symbol: 'FLR', price: 0.022, change24h: 0.8, volume24h: 35000000, popular: false },
  { name: 'Ronin', symbol: 'RON', price: 2.15, change24h: 1.2, volume24h: 25000000, popular: false },
  { name: 'Pyth Network', symbol: 'PYTH', price: 0.42, change24h: 2.5, volume24h: 95000000, popular: false },
  { name: 'ZetaChain', symbol: 'ZETA', price: 0.85, change24h: -0.5, volume24h: 28000000, popular: false },
  { name: 'Mantle', symbol: 'MNT', price: 0.65, change24h: 1.8, volume24h: 65000000, popular: false },
  { name: 'Blast', symbol: 'BLAST', price: 0.025, change24h: 3.2, volume24h: 85000000, popular: false },
  { name: 'ZkSync', symbol: 'ZK', price: 0.22, change24h: -0.9, volume24h: 42000000, popular: false },
  { name: 'Notcoin', symbol: 'NOT', price: 0.0085, change24h: 5.5, volume24h: 280000000, popular: false },
  { name: 'Toncoin', symbol: 'TON', price: 5.85, change24h: 4.2, volume24h: 520000000, popular: true },
  { name: 'Bitget Token', symbol: 'BGB', price: 1.25, change24h: 0.3, volume24h: 45000000, popular: false },
  { name: 'Ethena', symbol: 'ENA', price: 0.65, change24h: 2.1, volume24h: 95000000, popular: false },
  { name: 'EigenLayer', symbol: 'EIGEN', price: 3.25, change24h: -0.8, volume24h: 85000000, popular: false },
];

async function main() {
  console.log('Seeding database...');

  // 1. Create assets (USD, BTC, ETH)
  const assetMap = {};
  for (const a of ASSET_DEFS) {
    const asset = await prisma.asset.upsert({
      where: { symbol: a.symbol },
      create: a,
      update: { name: a.name, walletAddress: a.walletAddress },
    });
    assetMap[a.symbol] = asset.id;
  }
  console.log(`  → ${ASSET_DEFS.length} assets`);

  // 2. Create trading pairs
  for (const tp of TRADING_PAIRS) {
    await prisma.tradingPair.upsert({
      where: { symbol: tp.symbol },
      create: {
        symbol: tp.symbol,
        baseAssetId: assetMap[tp.baseSymbol],
        quoteAssetId: assetMap[tp.quoteSymbol],
      },
      update: {},
    });
  }
  console.log(`  → ${TRADING_PAIRS.length} trading pairs`);

  // 3. Create tickers
  for (const t of TICKERS) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      create: t,
      update: { lastPrice: t.lastPrice },
    });
  }
  console.log(`  → ${TICKERS.length} tickers`);

  // 4. Create users and user_balances
  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email.toLowerCase() },
      include: { balances: true },
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

    for (const asset of ASSET_DEFS) {
      const amount = DEMO_BALANCES[asset.symbol] ?? 0;
      await prisma.userBalance.create({
        data: {
          userId: user.id,
          assetId: assetMap[asset.symbol],
          balanceAvailable: amount,
          balanceLocked: 0,
        },
      });
    }
    console.log(`  → User ${u.email} + balances`);
  }

  // 5. Seed cryptos for Markets pages
  for (const c of CRYPTOS) {
    await prisma.crypto.upsert({
      where: { symbol: c.symbol },
      create: c,
      update: { price: c.price, change24h: c.change24h, volume24h: c.volume24h },
    });
  }
  console.log(`  → ${CRYPTOS.length} cryptos`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
