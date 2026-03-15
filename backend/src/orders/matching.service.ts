import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TickersService } from '../tickers/tickers.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private tickersService: TickersService,
  ) {}

  async getLastPrice(symbol: string): Promise<number> {
    const ticker = await this.tickersService.get(symbol);
    return ticker ? Number(ticker.lastPrice) : 0;
  }

  private async getOrCreateWallet(tx: Prisma.TransactionClient, userId: string, asset: string) {
    let w = await tx.wallet.findUnique({ where: { userId_asset: { userId, asset } } });
    if (!w) {
      w = await tx.wallet.create({ data: { userId, asset, balance: 0 } });
    }
    return w;
  }

  async matchOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.status !== 'open') return;

    const [base, quote] = order.symbol.split('_');
    let remaining = new Decimal(order.quantity).minus(order.filledQuantity);
    if (remaining.lte(0)) return;

    const oppositeSide = order.side === 'buy' ? 'sell' : 'buy';
    const limitPrice = order.price != null ? new Decimal(order.price) : null;

    const candidates = await this.prisma.order.findMany({
      where: {
        symbol: order.symbol,
        side: oppositeSide,
        status: 'open',
        id: { not: orderId },
        ...(limitPrice && order.side === 'buy' && { price: { lte: limitPrice } }),
        ...(limitPrice && order.side === 'sell' && { price: { gte: limitPrice } }),
      },
      orderBy: [{ createdAt: 'asc' }, { price: order.side === 'buy' ? 'asc' : 'desc' }],
    });

    for (const counter of candidates) {
      if (remaining.lte(0)) break;
      const counterRemaining = new Decimal(counter.quantity).minus(counter.filledQuantity);
      if (counterRemaining.lte(0)) continue;

      const counterPrice = counter.price;
      if (!counterPrice) continue;
      const matchPrice = Number(counterPrice);

      if (order.side === 'buy' && limitPrice && limitPrice.lt(counterPrice)) continue;
      if (order.side === 'sell' && limitPrice && limitPrice.gt(counterPrice)) continue;

      const fillQty = remaining.lte(counterRemaining) ? remaining : counterRemaining;
      const fillNum = Number(fillQty);
      if (fillNum <= 0) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.trade.create({
          data: { orderId: order.id, quantity: fillQty, price: counterPrice },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            filledQuantity: { increment: fillQty },
            status: remaining.eq(fillQty) ? 'filled' : 'open',
          },
        });
        await tx.order.update({
          where: { id: counter.id },
          data: {
            filledQuantity: { increment: fillQty },
            status: counterRemaining.eq(fillQty) ? 'filled' : 'open',
          },
        });

        const walletUpdate = async (uid: string, asset: string, delta: Decimal) => {
          const w = await this.getOrCreateWallet(tx, uid, asset);
          await tx.wallet.update({
            where: { id: w.id },
            data: { balance: { increment: delta } },
          });
        };

        if (order.side === 'buy') {
          await walletUpdate(order.userId, base, fillQty);
          await walletUpdate(order.userId, quote, new Decimal(-fillNum * matchPrice));
          await walletUpdate(counter.userId, base, new Decimal(0).minus(fillQty));
          await walletUpdate(counter.userId, quote, new Decimal(fillNum * matchPrice));
        } else {
          await walletUpdate(order.userId, base, new Decimal(0).minus(fillQty));
          await walletUpdate(order.userId, quote, new Decimal(fillNum * matchPrice));
          await walletUpdate(counter.userId, base, fillQty);
          await walletUpdate(counter.userId, quote, new Decimal(-fillNum * matchPrice));
        }

        await this.tickersService.setLastPrice(order.symbol, matchPrice, fillNum);
      });

      remaining = remaining.minus(fillQty);
    }
  }
}
