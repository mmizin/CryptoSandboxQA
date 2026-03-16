import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.prisma.userSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async deleteSessionByToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const result = await this.prisma.userSession.deleteMany({
      where: { tokenHash },
    });
    return result.count > 0;
  }

  async isSessionValid(tokenHash: string): Promise<boolean> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    return !!session;
  }

  getTokenHash(token: string): string {
    return this.hashToken(token);
  }

  async deleteAllUserSessions(userId: string): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: { userId },
    });
    return result.count;
  }
}
