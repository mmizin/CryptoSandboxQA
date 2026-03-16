import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async getBalances(userId: string) {
    const balances = await this.prisma.userBalance.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { asset: { symbol: 'asc' } },
    });

    return {
      balances: balances.map((b) => ({
        asset: b.asset.symbol,
        available: b.balanceAvailable.toString(),
        locked: b.balanceLocked.toString(),
        total: new Decimal(b.balanceAvailable).add(b.balanceLocked).toString(),
      })),
    };
  }

  async getSummary(userId: string) {
    const balances = await this.prisma.userBalance.findMany({
      where: { userId },
      include: { asset: true },
    });

    const assetsWithValue: Array<{
      symbol: string;
      amount: string;
      priceUsd: string;
      valueUsd: string;
    }> = [];
    let totalValueUsd = new Decimal(0);

    for (const b of balances) {
      const total = new Decimal(b.balanceAvailable).add(b.balanceLocked);
      if (total.lte(0)) continue;

      const priceUsd = await this.getPriceUsd(b.asset.symbol);
      const valueUsd = total.mul(priceUsd);
      totalValueUsd = totalValueUsd.add(valueUsd);

      assetsWithValue.push({
        symbol: b.asset.symbol,
        amount: total.toString(),
        priceUsd: priceUsd.toString(),
        valueUsd: valueUsd.toString(),
      });
    }

    return {
      totalValueUsd: totalValueUsd.toString(),
      assets: assetsWithValue,
    };
  }

  async getAllocation(userId: string) {
    const summary = await this.getSummary(userId);
    const total = new Decimal(summary.totalValueUsd);
    if (total.lte(0)) {
      return { allocations: [] };
    }

    const allocations = summary.assets.map((a) => {
      const value = new Decimal(a.valueUsd);
      const percentage = total.gt(0) ? value.mul(100).div(total).toNumber() : 0;
      return {
        symbol: a.symbol,
        percentage: Math.round(percentage * 100) / 100,
        valueUsd: a.valueUsd,
      };
    });

    return { allocations };
  }

  private async getPriceUsd(symbol: string): Promise<Decimal> {
    if (symbol === 'USD' || symbol === 'EUR') {
      return new Decimal(1);
    }
    const ticker = await this.prisma.ticker.findUnique({
      where: { symbol: `${symbol}_USD` },
    });
    if (ticker) return ticker.lastPrice;
    const crypto = await this.prisma.crypto.findUnique({
      where: { symbol },
    });
    if (crypto) return crypto.price;
    return new Decimal(0);
  }
}
