import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const SYMBOLS = ['BTC_USD', 'ETH_USD'];

@Injectable()
export class TickersService {
  constructor(private prisma: PrismaService) {}

  async get(symbol: string) {
    return this.prisma.ticker.findUnique({
      where: { symbol },
    });
  }

  async setLastPrice(symbol: string, price: number, quantity: number) {
    const data = { lastPrice: price, volume24h: { increment: quantity } };
    return this.prisma.ticker.upsert({
      where: { symbol },
      create: { symbol, lastPrice: price, volume24h: quantity },
      update: data,
    });
  }

  async getAll() {
    const rows = await this.prisma.ticker.findMany({
      where: { symbol: { in: SYMBOLS } },
    });
    return rows;
  }

  async seedInitialPrices() {
    const defaults: Record<string, number> = { BTC_USD: 50000, ETH_USD: 3000 };
    for (const symbol of SYMBOLS) {
      const price = defaults[symbol] ?? 1000;
      await this.prisma.ticker.upsert({
        where: { symbol },
        create: { symbol, lastPrice: price, volume24h: 0 },
        update: {},
      });
    }
  }
}
