import { Injectable, BadRequestException } from '@nestjs/common';
import { simulatedPersistDelay } from '../common/simulated-persist-delay';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { MatchingService } from './matching.service';
import { MailService } from '../mail/mail.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private matchingService: MatchingService,
    private mailService: MailService,
  ) {}

  private auditMetadata(meta?: Record<string, unknown>) {
    return meta ? { auditMetadata: meta } : {};
  }

  private async notifyOrderStatusEmail(
    userId: string,
    order: {
      id: string;
      symbol: string;
      side: string;
      orderStatus: string;
      quantity: unknown;
      filledQuantity: unknown;
      price: unknown;
    },
  ) {
    const st = order.orderStatus;
    if (st !== 'open' && st !== 'filled' && st !== 'cancelled') return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;
    await this.mailService.sendOrderStatusEmail(user.email, {
      status: st as 'open' | 'filled' | 'cancelled',
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: String(order.quantity),
      filledQuantity: String(order.filledQuantity),
      price: order.price != null ? String(order.price) : 'market',
    });
  }

  async create(
    userId: string,
    data: {
      symbol: string;
      side: string;
      type: string;
      quantity: number;
      price?: number;
      marketType?: string;
      initialStatus?: string;
    },
    auditMetadata?: Record<string, unknown>,
  ) {
    const pair = await this.prisma.tradingPair.findFirst({
      where: { symbol: data.symbol, isActive: true },
    });
    if (!pair) {
      const pairs = await this.prisma.tradingPair.findMany({
        where: { isActive: true },
        select: { symbol: true },
      });
      const allowed = pairs.map((p) => p.symbol).join(', ') || 'none configured';
      throw new BadRequestException(`Invalid symbol. Allowed: ${allowed}`);
    }
    if (!['buy', 'sell'].includes(data.side)) {
      throw new BadRequestException('Side must be buy or sell');
    }
    if (!['limit', 'market'].includes(data.type)) {
      throw new BadRequestException('Type must be limit or market');
    }
    if (data.quantity <= 0) throw new BadRequestException('Quantity must be positive');
    if (data.type === 'limit' && (data.price == null || data.price <= 0)) {
      throw new BadRequestException('Limit orders require a positive price');
    }

    const marketType = data.marketType ?? 'spot';
    const initialStatus = data.initialStatus ?? 'open';

    const [base, quote] = data.symbol.split('_');
    if (initialStatus !== 'cancelled') {
      if (data.side === 'sell') {
        const balance = await this.walletsService.getBalance(userId, base);
        if (new Decimal(balance).lt(data.quantity)) {
          throw new BadRequestException('Insufficient balance');
        }
      } else {
        const price = data.type === 'market'
          ? await this.matchingService.getLastPrice(data.symbol)
          : data.price!;
        const cost = data.quantity * Number(price);
        const balance = await this.walletsService.getBalance(userId, quote);
        if (new Decimal(balance).lt(cost)) {
          throw new BadRequestException('Insufficient balance');
        }
      }
    }

    await simulatedPersistDelay();

    let order;
    if (initialStatus === 'filled') {
      const price =
        data.type === 'market'
          ? Number(await this.matchingService.getLastPrice(data.symbol))
          : data.price!;
      const cost = data.quantity * price;
      const [base, quoteAsset] = data.symbol.split('_');

      order = await this.prisma.order.create({
        data: {
          userId,
          marketType,
          symbol: data.symbol,
          side: data.side,
          orderType: data.type,
          quantity: data.quantity,
          price: data.price != null ? data.price : price,
          filledQuantity: data.quantity,
          orderStatus: 'filled',
          completedAt: new Date(),
        },
      });

      const audit = this.auditMetadata(auditMetadata);
      if (data.side === 'buy') {
        await this.walletsService.credit(userId, base, data.quantity, audit);
        await this.walletsService.debit(userId, quoteAsset, cost, audit);
      } else {
        await this.walletsService.debit(userId, base, data.quantity, audit);
        await this.walletsService.credit(userId, quoteAsset, cost, audit);
      }
    } else if (initialStatus === 'cancelled') {
      order = await this.prisma.order.create({
        data: {
          userId,
          marketType,
          symbol: data.symbol,
          side: data.side,
          orderType: data.type,
          quantity: data.quantity,
          price: data.price != null ? data.price : null,
          filledQuantity: 0,
          orderStatus: 'cancelled',
          completedAt: new Date(),
        },
      });
    } else {
      const lockRefPrice =
        data.type === 'limit'
          ? data.price!
          : data.side === 'buy'
            ? await this.matchingService.getLastPrice(data.symbol)
            : undefined;

      const orderPriceForRow =
        data.type === 'limit'
          ? data.price!
          : data.side === 'buy'
            ? lockRefPrice!
            : null;

      order = await this.prisma.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            userId,
            marketType,
            symbol: data.symbol,
            side: data.side,
            orderType: data.type,
            quantity: data.quantity,
            price: orderPriceForRow,
            filledQuantity: 0,
            orderStatus: 'open',
          },
        });
        if (data.side === 'sell') {
          await this.walletsService.lockForOrderInTx(
            tx,
            userId,
            base,
            new Decimal(data.quantity),
            o.id,
            auditMetadata,
          );
        } else {
          await this.walletsService.lockForOrderInTx(
            tx,
            userId,
            quote,
            new Decimal(data.quantity).mul(lockRefPrice!),
            o.id,
            auditMetadata,
          );
        }
        return o;
      });

      await this.matchingService.matchOrder(order.id);
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
    if (updated) await this.notifyOrderStatusEmail(userId, updated);
    return updated ? this.mapOrderForResponse(updated) : null;
  }

  async setStatus(
    userId: string,
    orderId: string,
    status: string,
    auditMetadata?: Record<string, unknown>,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (!['open', 'filled', 'cancelled'].includes(status)) {
      throw new BadRequestException('Status must be open, filled, or cancelled');
    }

    if (status === 'filled') {
      if (order.orderStatus === 'filled') throw new BadRequestException('Order is already filled');
      const [base, quote] = order.symbol.split('_');
      const priceNum =
        order.price != null ? Number(order.price) : Number(await this.matchingService.getLastPrice(order.symbol));
      const remainingQty = new Decimal(order.quantity).minus(order.filledQuantity);
      const reservePerUnit =
        order.side === 'buy'
          ? order.price != null
            ? new Decimal(order.price)
            : new Decimal(priceNum)
          : new Decimal(0);

      await this.prisma.$transaction(async (tx) => {
        if (remainingQty.gt(0)) {
          if (order.side === 'buy') {
            await this.walletsService.settleBuyFillInTx(
              tx,
              userId,
              base,
              quote,
              remainingQty,
              new Decimal(priceNum),
              reservePerUnit,
            );
          } else {
            await this.walletsService.settleSellFillInTx(
              tx,
              userId,
              base,
              quote,
              remainingQty,
              new Decimal(priceNum),
            );
          }
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            filledQuantity: order.quantity,
            orderStatus: 'filled',
            completedAt: new Date(),
          },
        });
      });
    } else if (status === 'cancelled') {
      if (order.orderStatus !== 'open') {
        throw new BadRequestException('Only open orders can be cancelled');
      }
      const [base, quote] = order.symbol.split('_');
      const remainingQty = new Decimal(order.quantity).minus(order.filledQuantity);
      await this.prisma.$transaction(async (tx) => {
        if (remainingQty.gt(0)) {
          if (order.side === 'sell') {
            await this.walletsService.unlockForOrderInTx(tx, userId, base, remainingQty, orderId, auditMetadata);
          } else {
            const p =
              order.price != null
                ? new Decimal(order.price)
                : new Decimal(await this.matchingService.getLastPrice(order.symbol));
            await this.walletsService.unlockForOrderInTx(
              tx,
              userId,
              quote,
              remainingQty.mul(p),
              orderId,
              auditMetadata,
            );
          }
        }
        await tx.order.update({
          where: { id: orderId },
          data: { orderStatus: 'cancelled', completedAt: new Date() },
        });
      });
    } else if (status === 'open') {
      if (order.orderStatus !== 'cancelled') {
        throw new BadRequestException('Only cancelled orders can be reopened (testing)');
      }
      const [base, quote] = order.symbol.split('_');
      await this.prisma.$transaction(async (tx) => {
        if (order.side === 'sell') {
          await this.walletsService.lockForOrderInTx(
            tx,
            userId,
            base,
            new Decimal(order.quantity),
            orderId,
            auditMetadata,
          );
        } else {
          const p =
            order.price != null
              ? new Decimal(order.price)
              : new Decimal(await this.matchingService.getLastPrice(order.symbol));
          await this.walletsService.lockForOrderInTx(
            tx,
            userId,
            quote,
            new Decimal(order.quantity).mul(p),
            orderId,
            auditMetadata,
          );
        }
        await tx.order.update({
          where: { id: orderId },
          data: { orderStatus: 'open', completedAt: null, filledQuantity: 0 },
        });
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
    if (updated) await this.notifyOrderStatusEmail(userId, updated);
    return updated ? this.mapOrderForResponse(updated) : null;
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.orderStatus !== 'open') {
      throw new BadRequestException('Only open orders can be cancelled');
    }
    const [base, quote] = order.symbol.split('_');
    const remainingQty = new Decimal(order.quantity).minus(order.filledQuantity);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (remainingQty.gt(0)) {
        if (order.side === 'sell') {
          await this.walletsService.unlockForOrderInTx(tx, userId, base, remainingQty, orderId);
        } else {
          const p =
            order.price != null
              ? new Decimal(order.price)
              : new Decimal(await this.matchingService.getLastPrice(order.symbol));
          await this.walletsService.unlockForOrderInTx(tx, userId, quote, remainingQty.mul(p), orderId);
        }
      }
      return tx.order.update({
        where: { id: orderId },
        data: { orderStatus: 'cancelled', completedAt: new Date() },
        include: { tradesAsTaker: true, tradesAsMaker: true },
      });
    });
    await this.notifyOrderStatusEmail(userId, updated);
    return this.mapOrderForResponse(updated);
  }

  async findByUser(
    userId: string,
    filters?: {
      marketType?: string;
      status?: string;
      symbol?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    const where: {
      userId: string;
      marketType?: string;
      orderStatus?: string;
      symbol?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { userId };

    if (filters?.marketType) where.marketType = filters.marketType;
    if (filters?.status) where.orderStatus = filters.status;
    if (filters?.symbol) where.symbol = filters.symbol;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { tradesAsTaker: true, tradesAsMaker: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => this.mapOrderForResponse(o)),
      total,
      meta: { total, limit, offset },
    };
  }

  async findById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
    return order ? this.mapOrderForResponse(order) : null;
  }

  private mapOrderForResponse(order: { tradesAsTaker: unknown[]; tradesAsMaker: unknown[] } & Record<string, unknown>) {
    const { tradesAsTaker, tradesAsMaker, orderType, orderStatus, ...rest } = order;
    const trades = [...(tradesAsTaker || []), ...(tradesAsMaker || [])];
    return { ...rest, type: orderType, status: orderStatus, trades };
  }
}
