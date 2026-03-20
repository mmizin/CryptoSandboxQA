import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { simulatedPersistDelay } from '../common/simulated-persist-delay';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

const FIAT_CURRENCIES = ['USD', 'EUR'] as const;
const CARD_FEE_PERCENT = 2.5;
const SEPA_FEE = 0;

@Injectable()
export class DepositsService {
  constructor(
    private prisma: PrismaService,
    private walletsService: WalletsService,
  ) {}

  async depositFiat(
    userId: string,
    data: {
      fiatCurrency: string;
      amount: number;
      paymentMethodId?: string;
      auditMetadata?: Record<string, unknown>;
    },
  ) {
    if (!FIAT_CURRENCIES.includes(data.fiatCurrency as (typeof FIAT_CURRENCIES)[number])) {
      throw new BadRequestException(`Invalid currency. Allowed: ${FIAT_CURRENCIES.join(', ')}`);
    }
    if (data.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    await simulatedPersistDelay();

    const fee = CARD_FEE_PERCENT > 0 ? new Decimal(data.amount).mul(CARD_FEE_PERCENT).div(100) : new Decimal(SEPA_FEE);
    const amountToCredit = new Decimal(data.amount);

    const deposit = await this.prisma.$transaction(async (tx) => {
      const dep = await tx.depositFiat.create({
        data: {
          userId,
          fiatCurrency: data.fiatCurrency,
          amount: amountToCredit,
          fee,
          paymentMethodId: data.paymentMethodId || null,
          paymentMethodType: data.paymentMethodId ? 'card' : null,
          status: 'completed', // Sandbox: instant completion
          completedAt: new Date(),
        },
      });

      const creditResult = await this.walletsService.credit(userId, data.fiatCurrency, Number(amountToCredit), {
        refType: 'deposit_fiat',
        refId: dep.id,
        tx,
        auditMetadata: data.auditMetadata,
      });

      return { deposit: dep, creditResult };
    });

    return {
      deposit: this.mapDepositFiat(deposit.deposit),
      balance: deposit.creditResult.balance,
      transaction: deposit.creditResult.transaction,
      meta: { userId: deposit.deposit.userId },
    };
  }

  async listFiatDeposits(userId: string, params?: { limit?: number; offset?: number; from?: string; to?: string }) {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);
    const where: { userId: string; createdAt?: { gte?: Date; lte?: Date } } = { userId };

    if (params?.from || params?.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.depositFiat.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.depositFiat.count({ where }),
    ]);

    return {
      data: data.map((d) => this.mapDepositFiat(d)),
      total,
      meta: { total, limit, offset },
    };
  }

  async getFiatDeposit(userId: string, id: string) {
    const dep = await this.prisma.depositFiat.findFirst({
      where: { id, userId },
    });
    if (!dep) throw new NotFoundException('Deposit not found');
    return this.mapDepositFiat(dep);
  }

  async getCryptoDepositAddress(userId: string, symbol: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { symbol: symbol.toUpperCase(), assetType: 'crypto', isActive: true },
    });
    if (!asset) {
      throw new BadRequestException(`Invalid crypto symbol: ${symbol}`);
    }

    const walletAddress = asset.walletAddress || this.generateMockAddress(userId, symbol);

    return {
      userId,
      symbol: asset.symbol,
      walletAddress,
      expiresAt: null,
    };
  }

  async depositCrypto(
    userId: string,
    data: {
      symbol: string;
      amount: number;
      walletAddress: string;
      txHash?: string;
      auditMetadata?: Record<string, unknown>;
    },
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { symbol: data.symbol.toUpperCase(), assetType: 'crypto', isActive: true },
    });
    if (!asset) {
      throw new BadRequestException(`Invalid crypto symbol: ${data.symbol}`);
    }

    await simulatedPersistDelay();

    const deposit = await this.prisma.$transaction(async (tx) => {
      const dep = await tx.depositCrypto.create({
        data: {
          userId,
          assetId: asset.id,
          amount: data.amount,
          walletAddress: data.walletAddress,
          txHash: data.txHash || null,
          status: 'completed', // Sandbox: instant completion
          completedAt: new Date(),
        },
      });

      const creditResult = await this.walletsService.credit(userId, asset.symbol, data.amount, {
        refType: 'deposit_crypto',
        refId: dep.id,
        tx,
        auditMetadata: data.auditMetadata,
      });

      return { deposit: dep, creditResult };
    });

    return {
      deposit: this.mapDepositCryptoWithAsset({ ...deposit.deposit, asset }),
      balance: deposit.creditResult.balance,
      transaction: deposit.creditResult.transaction,
      meta: { userId: deposit.deposit.userId },
    };
  }

  async listCryptoDeposits(userId: string, params?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const [data, total] = await Promise.all([
      this.prisma.depositCrypto.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.depositCrypto.count({ where: { userId } }),
    ]);

    return {
      data: data.map((d) => this.mapDepositCryptoWithAsset(d)),
      total,
      meta: { total, limit, offset },
    };
  }

  async getCryptoDeposit(userId: string, id: string) {
    const dep = await this.prisma.depositCrypto.findFirst({
      where: { id, userId },
      include: { asset: true },
    });
    if (!dep) throw new NotFoundException('Deposit not found');
    return this.mapDepositCryptoWithAsset(dep);
  }

  private mapDepositFiat(d: { id: string; userId: string; fiatCurrency: string; amount: Decimal; fee: Decimal; status: string; createdAt: Date; completedAt: Date | null }) {
    return {
      id: d.id,
      userId: d.userId,
      fiatCurrency: d.fiatCurrency,
      amount: d.amount.toString(),
      fee: d.fee.toString(),
      status: d.status,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    };
  }

  private mapDepositCrypto(d: { id: string; userId: string; amount: Decimal; walletAddress: string; status: string; createdAt: Date }) {
    return {
      id: d.id,
      userId: d.userId,
      amount: d.amount.toString(),
      walletAddress: d.walletAddress,
      status: d.status,
      createdAt: d.createdAt,
    };
  }

  private mapDepositCryptoWithAsset(
    d: { id: string; userId: string; amount: Decimal; walletAddress: string; status: string; createdAt: Date; asset: { symbol: string } },
  ) {
    return {
      ...this.mapDepositCrypto(d),
      symbol: d.asset.symbol,
    };
  }

  private generateMockAddress(userId: string, symbol: string): string {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(`${userId}:${symbol}`).digest('hex').slice(0, 32);
    return `bc1q${hash}`;
  }
}
