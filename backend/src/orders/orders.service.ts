import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { MatchingService } from './matching.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private matchingService: MatchingService,
  ) {}

  private auditMetadata(meta?: Record<string, unknown>) {
    return meta ? { auditMetadata: meta } : {};
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
          orderStatus: 'open',
        },
      });
      await this.matchingService.matchOrder(order.id);
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
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
      const price = order.price != null ? Number(order.price) : Number(await this.matchingService.getLastPrice(order.symbol));
      const cost = Number(order.quantity) * price;
      const qty = Number(order.quantity);

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          filledQuantity: order.quantity,
          orderStatus: 'filled',
          completedAt: new Date(),
        },
      });

      const audit = this.auditMetadata(auditMetadata);
      if (order.side === 'buy') {
        await this.walletsService.credit(userId, base, qty, audit);
        await this.walletsService.debit(userId, quote, cost, audit);
      } else {
        await this.walletsService.debit(userId, base, qty, audit);
        await this.walletsService.credit(userId, quote, cost, audit);
      }
    } else if (status === 'cancelled') {
      if (order.orderStatus !== 'open') {
        throw new BadRequestException('Only open orders can be cancelled');
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: 'cancelled', completedAt: new Date() },
      });
    } else if (status === 'open') {
      if (order.orderStatus !== 'cancelled') {
        throw new BadRequestException('Only cancelled orders can be reopened (testing)');
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: 'open', completedAt: null, filledQuantity: 0 },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
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
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: 'cancelled', completedAt: new Date() },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
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
