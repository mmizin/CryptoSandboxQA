import { Injectable, BadRequestException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async getSetup(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    const existing = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (existing?.enabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `CryptoSandboxQA (${userId.slice(0, 8)})`,
      length: 20,
    });

    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: 'CryptoSandboxQA',
      encoding: 'ascii',
    });

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Upsert 2FA record with secret (not yet enabled)
    await this.prisma.userTwoFactor.upsert({
      where: { userId },
      create: {
        userId,
        secret: secret.base32,
        backupCodes: [],
        enabled: false,
      },
      update: {
        secret: secret.base32,
        backupCodes: [],
        enabled: false,
      },
    });

    return {
      qrCodeUrl,
      secret: secret.base32,
    };
  }

  async enable(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor) {
      throw new BadRequestException('2FA setup not initiated. Call GET /auth/2fa/setup first.');
    }
    if (twoFactor.enabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const valid = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.userTwoFactor.update({
      where: { userId },
      data: {
        enabled: true,
        enabledAt: new Date(),
        backupCodes: hashedCodes,
      },
    });

    return { backupCodes };
  }

  async disable(userId: string, code: string): Promise<void> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor || !twoFactor.enabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const validTotp = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (validTotp) {
      await this.prisma.userTwoFactor.update({
        where: { userId },
        data: { enabled: false, enabledAt: null, backupCodes: [] },
      });
      return;
    }

    // Check backup codes
    const backupCodes = (twoFactor.backupCodes as string[]) || [];
    for (let i = 0; i < backupCodes.length; i++) {
      const match = await bcrypt.compare(code, backupCodes[i]);
      if (match) {
        const updated = [...backupCodes];
        updated.splice(i, 1);
        await this.prisma.userTwoFactor.update({
          where: { userId },
          data: {
            enabled: false,
            enabledAt: null,
            backupCodes: updated,
          },
        });
        return;
      }
    }

    throw new BadRequestException('Invalid verification code');
  }

  async getBackupCodes(userId: string): Promise<{ codes: string[]; message: string }> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor || !twoFactor.enabled) {
      throw new BadRequestException('2FA is not enabled');
    }
    // Original backup codes are hashed - cannot return them.
    return {
      codes: [],
      message: 'Backup codes are shown only once during 2FA setup. Use regenerate to get new codes.',
    };
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor || !twoFactor.enabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.userTwoFactor.update({
      where: { userId },
      data: { backupCodes: hashedCodes },
    });

    return backupCodes;
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor || !twoFactor.enabled) {
      return false;
    }

    const validTotp = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (validTotp) return true;

    const backupCodes = (twoFactor.backupCodes as string[]) || [];
    for (let i = 0; i < backupCodes.length; i++) {
      const match = await bcrypt.compare(code, backupCodes[i]);
      if (match) {
        const updated = [...backupCodes];
        updated.splice(i, 1);
        await this.prisma.userTwoFactor.update({
          where: { userId },
          data: { backupCodes: updated },
        });
        return true;
      }
    }
    return false;
  }

  async getStatus(userId: string): Promise<{ enabled: boolean }> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    return { enabled: !!twoFactor?.enabled };
  }

  async is2FaEnabled(userId: string): Promise<boolean> {
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    return !!twoFactor?.enabled;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      let code = '';
      for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codes.push(code);
    }
    return codes;
  }
}
