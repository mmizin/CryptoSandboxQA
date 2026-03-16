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

  private async getOrCreateBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    assetSymbol: string,
  ) {
    const asset = await tx.asset.findUnique({ where: { symbol: assetSymbol } });
    if (!asset) throw new Error(`Asset ${assetSymbol} not found`);
    let b = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: asset.id } },
    });
    if (!b) {
      b = await tx.userBalance.create({
        data: { userId, assetId: asset.id, balanceAvailable: 0, balanceLocked: 0 },
      });
    }
    return b;
  }

  async matchOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.orderStatus !== 'open') return;

    const [base, quote] = order.symbol.split('_');
    let remaining = new Decimal(order.quantity).minus(order.filledQuantity);
    if (remaining.lte(0)) return;

    const oppositeSide = order.side === 'buy' ? 'sell' : 'buy';
    const limitPrice = order.price != null ? new Decimal(order.price) : null;
    const lastPrice = await this.getLastPrice(order.symbol);

    const candidates = await this.prisma.order.findMany({
      where: {
        symbol: order.symbol,
        marketType: order.marketType,
        side: oppositeSide,
        orderStatus: 'open',
        id: { not: orderId },
        ...(limitPrice &&
          order.side === 'buy' && {
            OR: [{ price: { lte: limitPrice } }, { price: null }],
          }),
        ...(limitPrice &&
          order.side === 'sell' && {
            OR: [{ price: { gte: limitPrice } }, { price: null }],
          }),
      },
      orderBy: [{ createdAt: 'asc' }, { price: order.side === 'buy' ? 'asc' : 'desc' }],
    });

    for (const counter of candidates) {
      if (remaining.lte(0)) break;
      const counterRemaining = new Decimal(counter.quantity).minus(counter.filledQuantity);
      if (counterRemaining.lte(0)) continue;

      const counterPrice = counter.price;
      const matchPrice =
        counterPrice != null
          ? Number(counterPrice)
          : limitPrice != null
            ? Number(limitPrice)
            : lastPrice;
      if (matchPrice <= 0) continue;

      if (order.side === 'buy' && limitPrice != null && limitPrice.lt(matchPrice)) continue;
      if (order.side === 'sell' && limitPrice != null && limitPrice.gt(matchPrice)) continue;

      const fillQty = remaining.lte(counterRemaining) ? remaining : counterRemaining;
      const fillNum = Number(fillQty);
      if (fillNum <= 0) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.trade.create({
          data: {
            symbol: order.symbol,
            takerOrderId: order.id,
            makerOrderId: counter.id,
            takerUserId: order.userId,
            makerUserId: counter.userId,
            quantity: fillQty,
            price: new Decimal(matchPrice),
          },
        });
        const newOrderStatus = remaining.eq(fillQty) ? 'filled' : 'open';
        const newCounterStatus = counterRemaining.eq(fillQty) ? 'filled' : 'open';
        await tx.order.update({
          where: { id: order.id },
          data: {
            filledQuantity: { increment: fillQty },
            orderStatus: newOrderStatus,
            ...(newOrderStatus !== 'open' && { completedAt: new Date() }),
          },
        });
        await tx.order.update({
          where: { id: counter.id },
          data: {
            filledQuantity: { increment: fillQty },
            orderStatus: newCounterStatus,
            ...(newCounterStatus !== 'open' && { completedAt: new Date() }),
          },
        });

        const balanceUpdate = async (uid: string, assetSym: string, delta: Decimal) => {
          const b = await this.getOrCreateBalance(tx, uid, assetSym);
          await tx.userBalance.update({
            where: { id: b.id },
            data: { balanceAvailable: { increment: delta } },
          });
        };

        if (order.side === 'buy') {
          await balanceUpdate(order.userId, base, fillQty);
          await balanceUpdate(order.userId, quote, new Decimal(-fillNum * matchPrice));
          await balanceUpdate(counter.userId, base, new Decimal(0).minus(fillQty));
          await balanceUpdate(counter.userId, quote, new Decimal(fillNum * matchPrice));
        } else {
          await balanceUpdate(order.userId, base, new Decimal(0).minus(fillQty));
          await balanceUpdate(order.userId, quote, new Decimal(fillNum * matchPrice));
          await balanceUpdate(counter.userId, base, fillQty);
          await balanceUpdate(counter.userId, quote, new Decimal(-fillNum * matchPrice));
        }

        await this.tickersService.setLastPrice(order.symbol, matchPrice, fillNum);
      });

      remaining = remaining.minus(fillQty);
    }
  }
}
