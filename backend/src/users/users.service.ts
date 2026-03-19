import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { email: string; passwordHash: string; displayName?: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
      },
    });
  }

  async createWithProfile(
    userData: { email: string; passwordHash: string; displayName?: string },
    profileData?: {
      username?: string;
      fullName?: string;
      photoUrl?: string;
      bio?: string;
      websiteUrl?: string;
      location?: string;
      birthday?: string;
      languageCode?: string;
      timezone?: string;
      preferences?: Record<string, unknown>;
    },
  ) {
    const hasProfileData =
      profileData &&
      Object.values(profileData).some((v) => v !== undefined && v !== null && v !== '');

    if (!hasProfileData) {
      return this.create(userData);
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: userData.email.toLowerCase(),
          passwordHash: userData.passwordHash,
          displayName: userData.displayName ?? null,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          username: profileData!.username ?? null,
          fullName: profileData!.fullName ?? null,
          photoUrl: profileData!.photoUrl ?? null,
          bio: profileData!.bio ?? null,
          websiteUrl: profileData!.websiteUrl ?? null,
          location: profileData!.location ?? null,
          birthday: profileData!.birthday ? new Date(profileData!.birthday) : null,
          languageCode: profileData!.languageCode ?? 'en',
          timezone: profileData!.timezone ?? 'UTC',
          preferences: (profileData!.preferences ?? {}) as object,
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: { profile: true },
      })!;
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdWithProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.userProfile.findUnique({
      where: { username },
      include: { user: true },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
