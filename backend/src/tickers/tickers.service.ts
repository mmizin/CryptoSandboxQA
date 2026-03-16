import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

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
    return this.prisma.ticker.findMany();
  }

  async seedInitialPrices() {
    const pairs = await this.prisma.tradingPair.findMany({ where: { isActive: true } });
    for (const p of pairs) {
      const ticker = await this.prisma.ticker.findUnique({ where: { symbol: p.symbol } });
      if (!ticker) {
        await this.prisma.ticker.create({
          data: { symbol: p.symbol, lastPrice: 1000, volume24h: 0 },
        });
      }
    }
  }
}
