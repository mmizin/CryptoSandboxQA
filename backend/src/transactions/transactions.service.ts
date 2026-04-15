import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getTransactions(
    userId: string,
    params?: {
      type?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const where: {
      userId: string;
      type?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { userId };

    if (params?.type) {
      where.type = params.type;
    }
    if (params?.from || params?.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.balanceTransaction.findMany({
        where,
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.balanceTransaction.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        asset: t.asset.symbol,
        amount: t.amount.toString(),
        balanceBefore: t.balanceBefore.toString(),
        balanceAfter: t.balanceAfter.toString(),
        refType: t.refType,
        refId: t.refId,
        metadata: t.metadata,
        createdAt: t.createdAt,
      })),
      total,
      meta: { total, limit, offset },
    };
  }

  async getDepositHistory(userId: string, params?: { limit?: number; offset?: number; from?: string; to?: string }) {
    return this.getTransactions(userId, {
      ...params,
      type: 'deposit',
    });
  }

  async getTradeHistory(userId: string, params?: { limit?: number; offset?: number; from?: string; to?: string }) {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const where: {
      OR: Array<{ takerUserId: string } | { makerUserId: string }>;
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      OR: [{ takerUserId: userId }, { makerUserId: userId }],
    };

    if (params?.from || params?.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.trade.count({ where }),
    ]);

    return {
      data: data.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        quantity: t.quantity.toString(),
        price: t.price.toString(),
        side: t.takerUserId === userId ? 'taker' : 'maker',
        takerUserId: t.takerUserId,
        makerUserId: t.makerUserId,
        createdAt: t.createdAt,
      })),
      total,
      meta: { total, limit, offset },
    };
  }

  async getWithdrawalHistory(userId: string, params?: { limit?: number; offset?: number }) {
    return this.getTransactions(userId, {
      ...params,
      type: 'withdraw',
    });
  }

  async getTransferHistory(
    userId: string,
    params?: { limit?: number; offset?: number; from?: string; to?: string },
  ) {
    return this.getTransactions(userId, {
      ...params,
      type: 'transfer',
    });
  }
}
