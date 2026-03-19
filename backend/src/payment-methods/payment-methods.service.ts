import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentMethodsService {
  constructor(private prisma: PrismaService) {}

  async findAllByUser(userId: string) {
    return this.prisma.userPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findByUserAndId(userId: string, id: string) {
    return this.prisma.userPaymentMethod.findFirst({
      where: { id, userId },
    });
  }

  async create(
    userId: string,
    data: { type: string; maskedDetails: Record<string, unknown> },
  ) {
    const existing = await this.prisma.userPaymentMethod.count({
      where: { userId },
    });
    const isDefault = existing === 0;

    return this.prisma.userPaymentMethod.create({
      data: {
        userId,
        type: data.type,
        maskedDetails: data.maskedDetails as object,
        isDefault,
        isVerified: true, // Mock: treat as verified in sandbox
      },
    });
  }

  async delete(userId: string, id: string) {
    const pm = await this.prisma.userPaymentMethod.findFirst({
      where: { id, userId },
    });
    if (!pm) {
      throw new NotFoundException('Payment method not found');
    }

    await this.prisma.userPaymentMethod.delete({
      where: { id },
    });

    if (pm.isDefault) {
      const next = await this.prisma.userPaymentMethod.findFirst({
        where: { userId },
      });
      if (next) {
        await this.prisma.userPaymentMethod.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { success: true };
  }

  async setDefault(userId: string, id: string) {
    const pm = await this.prisma.userPaymentMethod.findFirst({
      where: { id, userId },
    });
    if (!pm) {
      throw new NotFoundException('Payment method not found');
    }

    await this.prisma.$transaction([
      this.prisma.userPaymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userPaymentMethod.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.userPaymentMethod.findUnique({
      where: { id },
    });
  }
}
