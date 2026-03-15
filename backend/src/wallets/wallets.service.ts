import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const ASSETS = ['USD', 'BTC', 'ETH'] as const;

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(userId: string, asset: string) {
    this.validateAsset(asset);
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_asset: { userId, asset } },
    });
    if (wallet) return wallet;
    return this.prisma.wallet.create({
      data: { userId, asset, balance: 0 },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { asset: 'asc' },
    });
  }

  async credit(userId: string, asset: string, amount: number | Decimal) {
    this.validateAsset(asset);
    const wallet = await this.getOrCreate(userId, asset);
    const amt = typeof amount === 'number' ? new Decimal(amount) : amount;
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');
    const balanceBefore = wallet.balance;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amt } },
      });
      await tx.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          asset,
          amount: amt,
          type: 'deposit',
          balanceBefore,
        },
      });
      return updated;
    });
  }

  async debit(userId: string, asset: string, amount: number | Decimal) {
    this.validateAsset(asset);
    const wallet = await this.getOrCreate(userId, asset);
    const amt = typeof amount === 'number' ? new Decimal(amount) : amount;
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');
    if (new Decimal(wallet.balance).lt(amt)) {
      throw new BadRequestException('Insufficient balance');
    }
    const balanceBefore = wallet.balance;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amt } },
      });
      await tx.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          asset,
          amount: new Decimal(0).minus(amt),
          type: 'withdraw',
          balanceBefore,
        },
      });
      return updated;
    });
  }

  async getBalance(userId: string, asset: string): Promise<Decimal> {
    const wallet = await this.getOrCreate(userId, asset);
    return wallet.balance;
  }

  private validateAsset(asset: string) {
    if (!ASSETS.includes(asset as typeof ASSETS[number])) {
      throw new BadRequestException(`Invalid asset. Allowed: ${ASSETS.join(', ')}`);
    }
  }
}
