import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const FIAT_CURRENCIES = ['USD', 'EUR'] as const;
type TxClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

export interface DebitResult {
  userId: string;
  balance: {
    id: string;
    asset: string;
    balance: string;
    balanceAvailable: string;
    balanceLocked: string;
  };
  transaction: {
    id: string;
    type: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    refType: string | null;
    refId: string | null;
    createdAt: Date;
  };
}

export interface CreditResult {
  userId: string;
  deposit?: {
    id: string;
    depositType: 'fiat' | 'crypto';
    fiatCurrency?: string;
    symbol?: string;
    amount: string;
    status: string;
    completedAt: Date | null;
    createdAt?: Date;
  };
  balance: {
    id: string;
    asset: string;
    balance: string;
    balanceAvailable: string;
    balanceLocked: string;
  };
  transaction?: {
    id: string;
    type: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    refType: string | null;
    refId: string | null;
    createdAt: Date;
  };
}

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  private async getAssetBySymbol(asset: string) {
    const a = await this.prisma.asset.findUnique({ where: { symbol: asset.toUpperCase() } });
    if (!a) {
      const allowed = await this.prisma.asset.findMany({
        where: { isActive: true },
        select: { symbol: true },
      });
      const list = allowed.map((x) => x.symbol).join(', ') || 'none configured';
      throw new BadRequestException(
        `Asset "${asset}" not found. Allowed: ${list}. Run "npm run db:seed" to populate the database.`,
      );
    }
    return a;
  }

  async getOrCreate(userId: string, asset: string) {
    const assetRow = await this.getAssetBySymbol(asset);
    let balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
      include: { asset: true },
    });
    if (balance) {
      const total = new Decimal(balance.balanceAvailable).add(balance.balanceLocked);
      return {
        id: balance.id,
        userId,
        asset: balance.asset.symbol,
        balance: total.toString(),
        balanceAvailable: balance.balanceAvailable.toString(),
        balanceLocked: balance.balanceLocked.toString(),
      };
    }
    balance = await this.prisma.userBalance.create({
      data: { userId, assetId: assetRow.id, balanceAvailable: 0, balanceLocked: 0 },
      include: { asset: true },
    });
    return {
      id: balance.id,
      userId,
      asset: balance.asset.symbol,
      balance: '0',
      balanceAvailable: '0',
      balanceLocked: '0',
    };
  }

  async findAllByUser(userId: string) {
    const balances = await this.prisma.userBalance.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { asset: { symbol: 'asc' } },
    });
    return balances.map((b) => {
      const total = new Decimal(b.balanceAvailable).add(b.balanceLocked);
      return {
        id: b.id,
        userId,
        asset: b.asset.symbol,
        balance: total.toString(),
        balanceAvailable: b.balanceAvailable.toString(),
        balanceLocked: b.balanceLocked.toString(),
      };
    });
  }

  async credit(
    userId: string,
    asset: string,
    amount: number | Decimal,
    options?: {
      refType?: string;
      refId?: string;
      tx?: TxClient;
      auditMetadata?: Record<string, unknown>;
    },
  ): Promise<CreditResult> {
    const amt = typeof amount === 'number' ? new Decimal(amount) : amount;
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');

    const isFiatTraining =
      !options?.refType &&
      FIAT_CURRENCIES.includes(asset.toUpperCase() as (typeof FIAT_CURRENCIES)[number]);

    if (isFiatTraining) {
      return this.prisma.$transaction(async (tx) => {
        const dep = await tx.depositFiat.create({
          data: {
            userId,
            fiatCurrency: asset.toUpperCase(),
            amount: amt,
            fee: 0,
            paymentMethodId: null,
            paymentMethodType: null,
            status: 'completed',
            completedAt: new Date(),
          },
        });
        const result = await this.doCredit(userId, asset, amount, { ...options, refType: 'deposit_fiat', refId: dep.id, tx });
        return this.buildDepositResponse(userId, dep.id, 'deposit_fiat', asset, amt.toString(), result, {
          depositType: 'fiat',
          fiatCurrency: asset.toUpperCase(),
          amount: amt.toString(),
          status: 'completed',
          completedAt: dep.completedAt,
        });
      });
    }

    const isCryptoTraining = !options?.refType;
    if (isCryptoTraining) {
      const assetRow = await this.getAssetBySymbol(asset);
      if (assetRow.assetType === 'crypto') {
        const mockAddress = this.mockCryptoAddress(userId, asset);
        return this.prisma.$transaction(async (tx) => {
          const dep = await tx.depositCrypto.create({
            data: {
              userId,
              assetId: assetRow.id,
              amount: amt,
              walletAddress: mockAddress,
              txHash: null,
              status: 'completed',
              completedAt: new Date(),
            },
          });
          const result = await this.doCredit(userId, asset, amount, {
            ...options,
            refType: 'deposit_crypto',
            refId: dep.id,
            tx,
          });
          return this.buildDepositResponse(userId, dep.id, 'deposit_crypto', asset, amt.toString(), result, {
            depositType: 'crypto',
            symbol: asset,
            amount: amt.toString(),
            status: 'completed',
            completedAt: dep.completedAt,
          });
        });
      }
    }

    const result = await this.doCredit(userId, asset, amount, options);
    return this.buildCreditResult(userId, result);
  }

  private mockCryptoAddress(userId: string, symbol: string): string {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(`${userId}:${symbol}:training`).digest('hex').slice(0, 32);
    return `training_${hash}`;
  }

  private buildCreditResult(
    userId: string,
    result: { id: string; asset: string; balance: string; balanceAvailable: string; balanceLocked: string; transaction?: CreditResult['transaction'] },
  ): CreditResult {
    return {
      userId,
      balance: {
        id: result.id,
        asset: result.asset,
        balance: result.balance,
        balanceAvailable: result.balanceAvailable,
        balanceLocked: result.balanceLocked,
      },
      transaction: result.transaction,
    };
  }

  private buildDepositResponse(
    userId: string,
    depositId: string,
    refType: string,
    asset: string,
    amount: string,
    result: { id: string; asset: string; balance: string; balanceAvailable: string; balanceLocked: string; transaction?: CreditResult['transaction'] },
    depositMeta: {
      depositType: 'fiat' | 'crypto';
      fiatCurrency?: string;
      symbol?: string;
      amount: string;
      status: string;
      completedAt: Date | null;
    },
  ): CreditResult {
    return {
      userId,
      deposit: {
        id: depositId,
        depositType: depositMeta.depositType,
        fiatCurrency: depositMeta.fiatCurrency,
        symbol: depositMeta.symbol,
        amount: depositMeta.amount,
        status: depositMeta.status,
        completedAt: depositMeta.completedAt,
      },
      balance: {
        id: result.id,
        asset: result.asset,
        balance: result.balance,
        balanceAvailable: result.balanceAvailable,
        balanceLocked: result.balanceLocked,
      },
      transaction: result.transaction,
    };
  }

  private async doCredit(
    userId: string,
    asset: string,
    amount: number | Decimal,
    options?: {
      refType?: string;
      refId?: string;
      tx?: TxClient;
      auditMetadata?: Record<string, unknown>;
    },
  ): Promise<{
    id: string;
    asset: string;
    balance: string;
    balanceAvailable: string;
    balanceLocked: string;
    transaction: CreditResult['transaction'];
  }> {
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
    const balanceBefore = new Decimal(balance.balanceAvailable).add(balance.balanceLocked);

    const run = async (tx: TxClient) => {
      const updated = await tx.userBalance.update({
        where: { id: balance!.id },
        data: { balanceAvailable: { increment: amt } },
        include: { asset: true },
      });
      const totalAfter = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      const bt = await tx.balanceTransaction.create({
        data: {
          userId,
          balanceId: balance!.id,
          assetId: assetRow.id,
          type: 'deposit',
          amount: amt,
          balanceBefore,
          balanceAfter: totalAfter,
          refType: options?.refType ?? null,
          refId: options?.refId ?? null,
          metadata: (options?.auditMetadata ?? {}) as object,
        },
      });
      const total = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      return {
        id: updated.id,
        asset: updated.asset.symbol,
        balance: total.toString(),
        balanceAvailable: updated.balanceAvailable.toString(),
        balanceLocked: updated.balanceLocked.toString(),
        transaction: {
          id: bt.id,
          type: bt.type,
          amount: bt.amount.toString(),
          balanceBefore: bt.balanceBefore.toString(),
          balanceAfter: bt.balanceAfter.toString(),
          refType: bt.refType,
          refId: bt.refId,
          createdAt: bt.createdAt,
        },
      };
    };

    if (options?.tx) {
      return run(options.tx);
    }
    return this.prisma.$transaction(run);
  }

  async debit(
    userId: string,
    asset: string,
    amount: number | Decimal,
    options?: { auditMetadata?: Record<string, unknown> },
  ): Promise<DebitResult> {
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
      const bt = await tx.balanceTransaction.create({
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
          metadata: (options?.auditMetadata ?? {}) as object,
        },
      });
      const total = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
      return {
        userId,
        balance: {
          id: updated.id,
          asset: updated.asset.symbol,
          balance: total.toString(),
          balanceAvailable: updated.balanceAvailable.toString(),
          balanceLocked: updated.balanceLocked.toString(),
        },
        transaction: {
          id: bt.id,
          type: bt.type,
          amount: bt.amount.toString(),
          balanceBefore: bt.balanceBefore.toString(),
          balanceAfter: bt.balanceAfter.toString(),
          refType: bt.refType,
          refId: bt.refId,
          createdAt: bt.createdAt,
        },
      };
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
}
