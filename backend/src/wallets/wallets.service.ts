import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const ASSETS = ['USD', 'BTC', 'ETH'] as const;

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  private async getAssetBySymbol(asset: string) {
    const a = await this.prisma.asset.findUnique({ where: { symbol: asset } });
    if (!a) throw new BadRequestException(`Invalid asset. Allowed: ${ASSETS.join(', ')}`);
    return a;
  }

  async getOrCreate(userId: string, asset: string) {
    this.validateAsset(asset);
    const assetRow = await this.getAssetBySymbol(asset);
    let balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
      include: { asset: true },
    });
    if (balance) {
      const total = new Decimal(balance.balanceAvailable).add(balance.balanceLocked);
      return { id: balance.id, asset: balance.asset.symbol, balance: total.toString() };
    }
    balance = await this.prisma.userBalance.create({
      data: { userId, assetId: assetRow.id, balanceAvailable: 0, balanceLocked: 0 },
      include: { asset: true },
    });
    return { id: balance.id, asset: balance.asset.symbol, balance: '0' };
  }

  async findAllByUser(userId: string) {
    const balances = await this.prisma.userBalance.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { asset: { symbol: 'asc' } },
    });
    return balances.map((b) => {
      const total = new Decimal(b.balanceAvailable).add(b.balanceLocked);
      return { id: b.id, asset: b.asset.symbol, balance: total.toString() };
    });
  }

  async credit(userId: string, asset: string, amount: number | Decimal) {
    this.validateAsset(asset);
    const assetRow = await this.getAssetBySymbol(asset);
    let balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
    });
    if (!balance) {
      balance = await this.prisma.userBalance.create({
        data: { userId, assetId: assetRow.id, balanceAvailable: 0, balanceLocked: 0 },
      });
    }
    const amt = typeof amount === 'number' ? new Decimal(amount) : amount;
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');
    const balanceBefore = new Decimal(balance.balanceAvailable).add(balance.balanceLocked);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.userBalance.update({
        where: { id: balance!.id },
        data: { balanceAvailable: { increment: amt } },
        include: { asset: true },
      });
      const totalAfter = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      await tx.balanceTransaction.create({
        data: {
          userId,
          balanceId: balance!.id,
          assetId: assetRow.id,
          type: 'deposit',
          amount: amt,
          balanceBefore,
          balanceAfter: totalAfter,
          refType: null,
          refId: null,
        },
      });
      const total = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      return { id: updated.id, asset: updated.asset.symbol, balance: total.toString() };
    });
  }

  async debit(userId: string, asset: string, amount: number | Decimal) {
    this.validateAsset(asset);
    const assetRow = await this.getAssetBySymbol(asset);
    const balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
      include: { asset: true },
    });
    if (!balance) throw new BadRequestException('Insufficient balance');
    const amt = typeof amount === 'number' ? new Decimal(amount) : amount;
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');
    const available = new Decimal(balance.balanceAvailable);
    if (available.lt(amt)) throw new BadRequestException('Insufficient balance');

    const balanceBefore = available.add(balance.balanceLocked);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.userBalance.update({
        where: { id: balance.id },
        data: { balanceAvailable: { decrement: amt } },
        include: { asset: true },
      });
      const totalAfter = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      await tx.balanceTransaction.create({
        data: {
          userId,
          balanceId: balance.id,
          assetId: assetRow.id,
          type: 'withdraw',
          amount: new Decimal(0).minus(amt),
          balanceBefore,
          balanceAfter: totalAfter,
          refType: null,
          refId: null,
        },
      });
      const total = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      return { id: updated.id, asset: updated.asset.symbol, balance: total.toString() };
    });
  }

  async getBalance(userId: string, asset: string): Promise<Decimal> {
    const assetRow = await this.getAssetBySymbol(asset);
    const balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
    });
    if (!balance) return new Decimal(0);
    return balance.balanceAvailable;
  }

  private validateAsset(asset: string) {
    if (!ASSETS.includes(asset as (typeof ASSETS)[number])) {
      throw new BadRequestException(`Invalid asset. Allowed: ${ASSETS.join(', ')}`);
    }
  }
}
