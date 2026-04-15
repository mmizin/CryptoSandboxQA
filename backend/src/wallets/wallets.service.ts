import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  private async getAssetBySymbol(asset: string) {
    const a = await this.prisma.asset.findUnique({ where: { symbol: asset.toUpperCase() } });
    if (!a) {
      const allowed = await this.prisma.asset.findMany({
        where: { isActive: true },
        select: { symbol: true },
      });
      const list = allowed.map((x) => x.symbol).join(', ') || 'none configured';
      throw new BadRequestException(
        `Asset "${asset}" not found. Allowed: ${list}. Run "npm run setup" (or "npm run db:seed" for demo accounts) to populate the database.`,
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
    if (balance) return this.formatWalletResponse(balance, userId);
    balance = await this.prisma.userBalance.create({
      data: { userId, assetId: assetRow.id, balanceAvailable: 0, balanceLocked: 0 },
      include: { asset: true },
    });
    return this.formatWalletResponse(balance, userId);
  }

  async findAllByUser(userId: string) {
    const balances = await this.prisma.userBalance.findMany({
      where: { userId },
      include: { asset: true },
      orderBy: { asset: { symbol: 'asc' } },
    });
    return balances.map((b) => this.formatWalletResponse(b, userId));
  }

  async findByUserAndAsset(userId: string, asset: string) {
    const assetRow = await this.getAssetBySymbol(asset);
    const balance = await this.prisma.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
      include: { asset: true },
    });
    if (!balance) return null;
    return this.formatWalletResponse(balance, userId);
  }

  private formatWalletResponse(
    balance: { id: string; asset: { symbol: string }; balanceAvailable: Decimal; balanceLocked: Decimal },
    userId: string,
  ) {
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
      const out = await this.prisma.$transaction(async (tx) => {
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
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user && out.deposit?.fiatCurrency) {
        await this.mailService.sendDepositFiatEmail(user.email, {
          depositId: out.deposit.id,
          fiatCurrency: out.deposit.fiatCurrency,
          amount: out.deposit.amount,
        });
      }
      return out;
    }

    const isCryptoTraining = !options?.refType;
    if (isCryptoTraining) {
      const assetRow = await this.getAssetBySymbol(asset);
      if (assetRow.assetType === 'crypto') {
        const mockAddress = this.mockCryptoAddress(userId, asset);
        const out = await this.prisma.$transaction(async (tx) => {
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
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user && out.deposit?.symbol) {
          await this.mailService.sendDepositCryptoEmail(user.email, {
            depositId: out.deposit.id,
            symbol: out.deposit.symbol,
            amount: out.deposit.amount,
          });
        }
        return out;
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

  /** Move funds from available → locked when an open order is placed. */
  async lockForOrderInTx(
    tx: TxClient,
    userId: string,
    asset: string,
    amount: Decimal,
    orderId: string,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    if (amount.lte(0)) return;
    const meta = (auditMetadata ?? {}) as object;
    const assetRow = await this.getAssetBySymbol(asset);
    let balance = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
    });
    if (!balance) {
      balance = await tx.userBalance.create({
        data: { userId, assetId: assetRow.id, balanceAvailable: 0, balanceLocked: 0 },
      });
    }
    const avail = new Decimal(balance.balanceAvailable);
    if (avail.lt(amount)) {
      throw new BadRequestException('Insufficient balance');
    }
    const balanceBefore = avail.add(balance.balanceLocked);
    const updated = await tx.userBalance.update({
      where: { id: balance.id },
      data: {
        balanceAvailable: { decrement: amount },
        balanceLocked: { increment: amount },
      },
      include: { asset: true },
    });
    const balanceAfter = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
    await tx.balanceTransaction.create({
      data: {
        userId,
        balanceId: balance.id,
        assetId: assetRow.id,
        type: 'order_lock',
        amount,
        balanceBefore,
        balanceAfter,
        refType: 'order',
        refId: orderId,
        metadata: meta,
      },
    });
  }

  /** Move funds from locked → available when an order is cancelled or remaining reservation is released. */
  async unlockForOrderInTx(
    tx: TxClient,
    userId: string,
    asset: string,
    amount: Decimal,
    orderId: string,
    auditMetadata?: Record<string, unknown>,
  ): Promise<void> {
    if (amount.lte(0)) return;
    const meta = (auditMetadata ?? {}) as object;
    const assetRow = await this.getAssetBySymbol(asset);
    const balance = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: assetRow.id } },
    });
    if (!balance) {
      throw new BadRequestException('Balance not found');
    }
    const locked = new Decimal(balance.balanceLocked);
    if (locked.lt(amount)) {
      throw new BadRequestException('Insufficient locked balance');
    }
    const balanceBefore = new Decimal(balance.balanceAvailable).add(balance.balanceLocked);
    const updated = await tx.userBalance.update({
      where: { id: balance.id },
      data: {
        balanceLocked: { decrement: amount },
        balanceAvailable: { increment: amount },
      },
      include: { asset: true },
    });
    const balanceAfter = new Decimal(updated.balanceAvailable).add(updated.balanceLocked);
    await tx.balanceTransaction.create({
      data: {
        userId,
        balanceId: balance.id,
        assetId: assetRow.id,
        type: 'order_unlock',
        amount,
        balanceBefore,
        balanceAfter,
        refType: 'order',
        refId: orderId,
        metadata: meta,
      },
    });
  }

  /** Seller: consume locked base, credit quote available. */
  async settleSellFillInTx(
    tx: TxClient,
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    fillQty: Decimal,
    matchPrice: Decimal,
  ): Promise<void> {
    const baseRow = await this.getAssetBySymbol(baseAsset);
    const quoteRow = await this.getAssetBySymbol(quoteAsset);
    const baseBal = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: baseRow.id } },
    });
    if (!baseBal) {
      throw new BadRequestException('Balance not found');
    }
    if (new Decimal(baseBal.balanceLocked).lt(fillQty)) {
      throw new BadRequestException('Insufficient locked base for sell');
    }
    let quoteBal = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: quoteRow.id } },
    });
    if (!quoteBal) {
      quoteBal = await tx.userBalance.create({
        data: { userId, assetId: quoteRow.id, balanceAvailable: 0, balanceLocked: 0 },
      });
    }
    const quoteCredit = fillQty.mul(matchPrice);
    await tx.userBalance.update({
      where: { id: baseBal.id },
      data: { balanceLocked: { decrement: fillQty } },
    });
    await tx.userBalance.update({
      where: { id: quoteBal.id },
      data: { balanceAvailable: { increment: quoteCredit } },
    });
  }

  /**
   * Buyer: release quote reserved at `reservePricePerUnit`, pay `matchPrice`, credit base.
   * Excess reservation returns to available when match is better than the reserved price.
   */
  async settleBuyFillInTx(
    tx: TxClient,
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    fillQty: Decimal,
    matchPrice: Decimal,
    reservePricePerUnit: Decimal,
  ): Promise<void> {
    const reservedReleased = fillQty.mul(reservePricePerUnit);
    const availDelta = reservedReleased.minus(fillQty.mul(matchPrice));

    const quoteRow = await this.getAssetBySymbol(quoteAsset);
    const baseRow = await this.getAssetBySymbol(baseAsset);

    const quoteBal = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: quoteRow.id } },
    });
    if (!quoteBal) {
      throw new BadRequestException('Quote balance not found');
    }
    if (new Decimal(quoteBal.balanceLocked).lt(reservedReleased)) {
      throw new BadRequestException('Insufficient locked quote for buy');
    }

    await tx.userBalance.update({
      where: { id: quoteBal.id },
      data: {
        balanceLocked: { decrement: reservedReleased },
        balanceAvailable: { increment: availDelta },
      },
    });

    let baseBal = await tx.userBalance.findUnique({
      where: { userId_assetId: { userId, assetId: baseRow.id } },
    });
    if (!baseBal) {
      baseBal = await tx.userBalance.create({
        data: { userId, assetId: baseRow.id, balanceAvailable: 0, balanceLocked: 0 },
      });
    }
    await tx.userBalance.update({
      where: { id: baseBal.id },
      data: { balanceAvailable: { increment: fillQty } },
    });
  }
}
