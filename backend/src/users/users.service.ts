import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AdminPatchUserDto } from './dto/admin-update-user.dto';
import { AdminReplaceUserDto } from './dto/admin-replace-user.dto';
import { BulkExportUsersQueryDto } from './dto/bulk-export-users.query.dto';

export type BulkExportedUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  profile: {
    username: string | null;
    fullName: string | null;
    photoUrl: string | null;
    bio: string | null;
    websiteUrl: string | null;
    location: string | null;
    birthday: string | null;
    languageCode: string;
    timezone: string;
    verificationStatus: string;
  } | null;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    email: string;
    passwordHash: string;
    displayName?: string;
    role?: 'user' | 'admin';
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
        role: data.role ?? 'user',
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
          role: 'user',
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

  async findAll(search?: string): Promise<
    Array<{ id: string; email: string; displayName: string | null; role: string }>
  > {
    const term = search?.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const orConditions: Prisma.UserWhereInput[] = [];
    if (term) {
      orConditions.push({ email: { contains: term, mode: 'insensitive' } });
      if (uuidRegex.test(term)) {
        orConditions.push({ id: term });
      }
    }
    const where: Prisma.UserWhereInput = orConditions.length > 0 ? { OR: orConditions } : {};

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, displayName: true, role: true },
      orderBy: { email: 'asc' },
      take: 100,
    });
    return users;
  }

  async exportBulk(q: BulkExportUsersQueryDto): Promise<{
    contentType: string;
    body: BulkExportedUserRow[] | string;
    attachmentFilename: string | null;
  }> {
    const format = q.format ?? 'json';
    if (q.preset === 'dateRange' && (!q.from || !q.to)) {
      throw new BadRequestException('from and to query params are required when preset is dateRange');
    }
    const rangeFrom = q.from ? new Date(q.from) : undefined;
    const rangeTo = q.to ? new Date(q.to) : undefined;
    if (q.preset === 'dateRange' && rangeFrom && rangeTo && rangeFrom.getTime() > rangeTo.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    let users;
    if (q.preset === 'first100') {
      users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { profile: true },
      });
    } else if (q.preset === 'last100') {
      users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { profile: true },
      });
    } else {
      users = await this.prisma.user.findMany({
        where: {
          createdAt: { gte: rangeFrom!, lte: rangeTo! },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
        include: { profile: true },
      });
    }

    const rows: BulkExportedUserRow[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      profile: u.profile
        ? {
            username: u.profile.username,
            fullName: u.profile.fullName,
            photoUrl: u.profile.photoUrl,
            bio: u.profile.bio,
            websiteUrl: u.profile.websiteUrl,
            location: u.profile.location,
            birthday: u.profile.birthday ? u.profile.birthday.toISOString().slice(0, 10) : null,
            languageCode: u.profile.languageCode,
            timezone: u.profile.timezone,
            verificationStatus: u.profile.verificationStatus,
          }
        : null,
    }));

    if (format === 'json') {
      return {
        contentType: 'application/json; charset=utf-8',
        body: rows,
        attachmentFilename: null,
      };
    }

    return {
      contentType: 'text/csv; charset=utf-8',
      body: this.buildUsersExportCsv(rows),
      attachmentFilename: 'users-export.csv',
    };
  }

  private buildUsersExportCsv(rows: BulkExportedUserRow[]): string {
    const headers = [
      'id',
      'email',
      'displayName',
      'role',
      'createdAt',
      'updatedAt',
      'username',
      'fullName',
      'photoUrl',
      'bio',
      'websiteUrl',
      'location',
      'birthday',
      'languageCode',
      'timezone',
      'verificationStatus',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const p = r.profile;
      const cells = [
        r.id,
        r.email,
        r.displayName ?? '',
        r.role,
        r.createdAt,
        r.updatedAt,
        p?.username ?? '',
        p?.fullName ?? '',
        p?.photoUrl ?? '',
        p?.bio ?? '',
        p?.websiteUrl ?? '',
        p?.location ?? '',
        p?.birthday ?? '',
        p?.languageCode ?? '',
        p?.timezone ?? '',
        p?.verificationStatus ?? '',
      ].map((c) => this.csvEscapeCell(String(c)));
      lines.push(cells.join(','));
    }
    return lines.join('\n');
  }

  private csvEscapeCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateProfile(
    userId: string,
    dto: {
      displayName?: string;
      photoUrl?: string;
      username?: string;
      bio?: string;
      fullName?: string;
      websiteUrl?: string;
      location?: string;
      birthday?: string;
      languageCode?: string;
      timezone?: string;
      preferences?: Record<string, unknown>;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const userData: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) userData.displayName = dto.displayName;

    const profileUpdate: Prisma.UserProfileUpdateInput = {};
    if (dto.photoUrl !== undefined) profileUpdate.photoUrl = dto.photoUrl;
    if (dto.username !== undefined) profileUpdate.username = dto.username;
    if (dto.bio !== undefined) profileUpdate.bio = dto.bio;
    if (dto.fullName !== undefined) profileUpdate.fullName = dto.fullName;
    if (dto.websiteUrl !== undefined) profileUpdate.websiteUrl = dto.websiteUrl;
    if (dto.location !== undefined) profileUpdate.location = dto.location;
    if (dto.birthday !== undefined)
      profileUpdate.birthday = dto.birthday ? new Date(dto.birthday) : null;
    if (dto.languageCode !== undefined)
      profileUpdate.languageCode = dto.languageCode;
    if (dto.timezone !== undefined) profileUpdate.timezone = dto.timezone;
    if (dto.preferences !== undefined)
      profileUpdate.preferences = dto.preferences as object;

    const hasUserUpdate = Object.keys(userData).length > 0;
    const hasProfileUpdate = Object.keys(profileUpdate).length > 0;

    if (hasProfileUpdate) {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...profileUpdate,
        } as Prisma.UserProfileUncheckedCreateInput,
        update: profileUpdate,
      });
    }

    if (hasUserUpdate) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    const updated = await this.findByIdWithProfile(userId);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  private async ensureEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
    const existing = await this.findByEmail(email);
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Email already in use');
    }
  }

  async updateByAdmin(userId: string, dto: AdminPatchUserDto) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.email !== undefined) {
      await this.ensureEmailAvailable(dto.email, userId);
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) userData.displayName = dto.displayName;
    if (dto.email !== undefined) userData.email = dto.email.toLowerCase();
    if (dto.role !== undefined) userData.role = dto.role;

    const profileUpdate: Prisma.UserProfileUpdateInput = {};
    if (dto.photoUrl !== undefined) profileUpdate.photoUrl = dto.photoUrl;
    if (dto.username !== undefined) profileUpdate.username = dto.username;
    if (dto.bio !== undefined) profileUpdate.bio = dto.bio;
    if (dto.fullName !== undefined) profileUpdate.fullName = dto.fullName;
    if (dto.websiteUrl !== undefined) profileUpdate.websiteUrl = dto.websiteUrl;
    if (dto.location !== undefined) profileUpdate.location = dto.location;
    if (dto.birthday !== undefined)
      profileUpdate.birthday = dto.birthday ? new Date(dto.birthday) : null;
    if (dto.languageCode !== undefined)
      profileUpdate.languageCode = dto.languageCode;
    if (dto.timezone !== undefined) profileUpdate.timezone = dto.timezone;
    if (dto.preferences !== undefined)
      profileUpdate.preferences = dto.preferences as object;

    if (Object.keys(profileUpdate).length > 0) {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...profileUpdate,
        } as Prisma.UserProfileUncheckedCreateInput,
        update: profileUpdate,
      });
    }

    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    const updated = await this.findByIdWithProfile(userId);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async replaceByAdmin(userId: string, dto: AdminReplaceUserDto) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    await this.ensureEmailAvailable(dto.email, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName,
          email: dto.email.toLowerCase(),
          role: dto.role,
        },
      });

      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          photoUrl: dto.photoUrl ?? null,
          username: dto.username ?? null,
          bio: dto.bio ?? null,
          fullName: dto.fullName ?? null,
          websiteUrl: dto.websiteUrl ?? null,
          location: dto.location ?? null,
          birthday: dto.birthday ? new Date(dto.birthday) : null,
          languageCode: dto.languageCode ?? 'en',
          timezone: dto.timezone ?? 'UTC',
          preferences: (dto.preferences ?? {}) as object,
        },
        update: {
          photoUrl: dto.photoUrl ?? null,
          username: dto.username ?? null,
          bio: dto.bio ?? null,
          fullName: dto.fullName ?? null,
          websiteUrl: dto.websiteUrl ?? null,
          location: dto.location ?? null,
          birthday: dto.birthday ? new Date(dto.birthday) : null,
          languageCode: dto.languageCode ?? 'en',
          timezone: dto.timezone ?? 'UTC',
          preferences: (dto.preferences ?? {}) as object,
        },
      });
    });

    const updated = await this.findByIdWithProfile(userId);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }
}
