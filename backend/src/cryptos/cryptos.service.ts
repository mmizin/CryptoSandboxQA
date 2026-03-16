import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CryptosService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);
    const search = params.search?.trim();
    const sortBy = params.sortBy ?? 'volume24h';
    const sortOrder = params.sortOrder ?? 'desc';

    const validSortFields = ['name', 'symbol', 'price', 'change24h', 'volume24h'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'volume24h';

    const where: Prisma.CryptoWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.crypto.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.crypto.count({ where }),
    ]);

    return {
      data: data.map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        price: c.price.toString(),
        change24h: c.change24h.toString(),
        volume24h: c.volume24h.toString(),
        popular: c.popular,
      })),
      total,
    };
  }

  async findBySymbol(symbol: string) {
    const crypto = await this.prisma.crypto.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!crypto) return null;
    return {
      id: crypto.id,
      name: crypto.name,
      symbol: crypto.symbol,
      price: crypto.price.toString(),
      change24h: crypto.change24h.toString(),
      volume24h: crypto.volume24h.toString(),
      popular: crypto.popular,
    };
  }

  async getPriceHistory(
    symbol: string,
    _from?: string,
    _to?: string,
    _interval?: string,
  ) {
    const crypto = await this.prisma.crypto.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    const ticker = await this.prisma.ticker.findUnique({
      where: { symbol: `${symbol.toUpperCase()}_USD` },
    });
    const price = crypto?.price ?? ticker?.lastPrice;
    if (!price) return { symbol: symbol.toUpperCase(), data: [] };
    return {
      symbol: symbol.toUpperCase(),
      data: [{ timestamp: new Date().toISOString(), price: price.toString() }],
    };
  }
}
