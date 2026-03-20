import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TickersService } from '../tickers/tickers.service';
import { WalletsService } from '../wallets/wallets.service';
import { MailService } from '../mail/mail.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private tickersService: TickersService,
    private walletsService: WalletsService,
    private mailService: MailService,
  ) {}

  async getLastPrice(symbol: string): Promise<number> {
    const ticker = await this.tickersService.get(symbol);
    return ticker ? Number(ticker.lastPrice) : 0;
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

      const newOrderStatus = remaining.eq(fillQty) ? 'filled' : 'open';
      const newCounterStatus = counterRemaining.eq(fillQty) ? 'filled' : 'open';

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

        const reserveForBuy = (b: typeof order) =>
          b.price != null ? new Decimal(b.price) : new Decimal(matchPrice);

        if (order.side === 'buy') {
          await this.walletsService.settleBuyFillInTx(
            tx,
            order.userId,
            base,
            quote,
            fillQty,
            new Decimal(matchPrice),
            reserveForBuy(order),
          );
          await this.walletsService.settleSellFillInTx(
            tx,
            counter.userId,
            base,
            quote,
            fillQty,
            new Decimal(matchPrice),
          );
        } else {
          await this.walletsService.settleSellFillInTx(
            tx,
            order.userId,
            base,
            quote,
            fillQty,
            new Decimal(matchPrice),
          );
          await this.walletsService.settleBuyFillInTx(
            tx,
            counter.userId,
            base,
            quote,
            fillQty,
            new Decimal(matchPrice),
            reserveForBuy(counter),
          );
        }

        await this.tickersService.setLastPrice(order.symbol, matchPrice, fillNum);
      });

      if (newCounterStatus === 'filled') {
        const freshCounter = await this.prisma.order.findUnique({
          where: { id: counter.id },
        });
        if (freshCounter) {
          const user = await this.prisma.user.findUnique({
            where: { id: freshCounter.userId },
            select: { email: true },
          });
          if (user) {
            await this.mailService.sendOrderStatusEmail(user.email, {
              status: 'filled',
              orderId: freshCounter.id,
              symbol: freshCounter.symbol,
              side: freshCounter.side,
              quantity: String(freshCounter.quantity),
              filledQuantity: String(freshCounter.filledQuantity),
              price: freshCounter.price != null ? String(freshCounter.price) : 'market',
            });
          }
        }
      }

      remaining = remaining.minus(fillQty);
    }
  }
}
