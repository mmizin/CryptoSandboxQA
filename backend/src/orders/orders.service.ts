import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { MatchingService } from './matching.service';
import { Decimal } from '@prisma/client/runtime/library';

const SYMBOLS = ['BTC_USD', 'ETH_USD'] as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
    private matchingService: MatchingService,
  ) {}

  async create(
    userId: string,
    data: { symbol: string; side: string; type: string; quantity: number; price?: number },
  ) {
    if (!SYMBOLS.includes(data.symbol as typeof SYMBOLS[number])) {
      throw new BadRequestException(`Invalid symbol. Allowed: ${SYMBOLS.join(', ')}`);
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

    const [base, quote] = data.symbol.split('_');
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

    const order = await this.prisma.order.create({
      data: {
        userId,
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
    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
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

  async findByUser(userId: string, filters?: { status?: string; symbol?: string }) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        ...(filters?.status && { orderStatus: filters.status }),
        ...(filters?.symbol && { symbol: filters.symbol }),
      },
      orderBy: { createdAt: 'desc' },
      include: { tradesAsTaker: true, tradesAsMaker: true },
    });
    return orders.map((o) => this.mapOrderForResponse(o));
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
