import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from './mail.service';
import { SessionsService } from './sessions.service';
import { TwoFactorService } from './two-factor.service';
import {
  parseImportFileContent,
  validatePayloadRow,
  type AdminImportPayload,
} from './bulk-user-import.parse';

export interface JwtPayload {
  sub: string;
  email: string;
  impersonatedBy?: string;
}

export interface Temp2FaPayload {
  sub: string;
  email: string;
  temp2fa: true;
}

export interface AuthResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    emailVerifiedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    profile?: unknown;
  };
}

export interface LoginRequires2FaResult {
  requires2FA: true;
  tempToken: string;
}

const JWT_EXPIRY = '7d';
const TEMP_2FA_EXPIRY = '5m';
const BACK_TO_ADMIN_EXPIRY = '1h';
const PASSWORD_RESET_CODE_TTL_MIN = 30;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private sessionsService: SessionsService,
    private twoFactorService: TwoFactorService,
    private prisma: PrismaService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthResult | LoginRequires2FaResult> {
    const user = await this.validateUser(email.toLowerCase(), password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const has2Fa = await this.twoFactorService.is2FaEnabled(user.id);
    if (has2Fa) {
      const tempPayload: Temp2FaPayload = {
        sub: user.id,
        email: user.email,
        temp2fa: true,
      };
      const tempToken = this.jwtService.sign(tempPayload, {
        expiresIn: TEMP_2FA_EXPIRY,
      });
      return {
        requires2FA: true,
        tempToken,
      };
    }

    const userWithProfile = await this.usersService.findByIdWithProfile(user.id);
    return this.issueTokenAndSession(userWithProfile!);
  }

  /** Same response whether or not the email exists (avoid account enumeration). */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalized);
    const generic = {
      message:
        'If an account exists for this email, a reset code has been sent. Check your inbox.',
    };

    if (!user) {
      return generic;
    }

    await this.prisma.userPasswordReset.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const codeHash = this.hashResetCode(code);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_CODE_TTL_MIN);

    await this.prisma.userPasswordReset.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetCode(user.email, code);
    return generic;
  }

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const codeHash = this.hashResetCode(code);
    const row = await this.prisma.userPasswordReset.findFirst({
      where: {
        userId: user.id,
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!row) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.userPasswordReset.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
    });

    await this.sessionsService.deleteAllUserSessions(user.id);
    return { success: true };
  }

  private hashResetCode(code: string): string {
    const pepper =
      this.config.get<string>('PASSWORD_RESET_CODE_PEPPER') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-secret-change-in-production';
    return createHmac('sha256', pepper).update(code, 'utf8').digest('hex');
  }

  async verify2Fa(tempToken: string, code: string): Promise<AuthResult> {
    let payload: Temp2FaPayload;
    try {
      payload = this.jwtService.verify<Temp2FaPayload>(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }
    if (!payload.temp2fa || !payload.sub) {
      throw new UnauthorizedException('Invalid temporary token');
    }

    const valid = await this.twoFactorService.verifyCode(payload.sub, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const userWithProfile = await this.usersService.findByIdWithProfile(payload.sub);
    if (!userWithProfile) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokenAndSession(userWithProfile);
  }

  async register(email: string, password: string, displayName?: string): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(email.toLowerCase());
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({ email, passwordHash: hash, displayName });
    return this.issueTokenAndSession(user);
  }

  async createAdmin(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(email.toLowerCase());
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      passwordHash: hash,
      displayName,
      role: 'admin',
    });
    return this.issueTokenAndSession(user);
  }

  async registerWithProfile(data: {
    email: string;
    password: string;
    displayName?: string;
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
  }): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(data.email.toLowerCase());
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }
    if (data.username) {
      const existingUsername = await this.usersService.findByUsername(data.username);
      if (existingUsername) {
        throw new UnauthorizedException('Username already taken');
      }
    }
    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.createWithProfile(
      { email: data.email, passwordHash: hash, displayName: data.displayName },
      {
        username: data.username,
        fullName: data.fullName,
        photoUrl: data.photoUrl,
        bio: data.bio,
        websiteUrl: data.websiteUrl,
        location: data.location,
        birthday: data.birthday,
        languageCode: data.languageCode,
        timezone: data.timezone,
        preferences: data.preferences,
      },
    );
    return this.issueTokenAndSession(user!);
  }

  /**
   * Creates a user with optional profile in the database (Prisma) — same as registerWithProfile but no JWT/session.
   */
  async createUserWithProfileAsAdmin(data: {
    email: string;
    password: string;
    displayName?: string;
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
  }) {
    const existing = await this.usersService.findByEmail(data.email.toLowerCase());
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    if (data.username) {
      const existingUsername = await this.usersService.findByUsername(data.username);
      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }
    const hash = await bcrypt.hash(data.password, 10);
    const created = await this.usersService.createWithProfile(
      { email: data.email, passwordHash: hash, displayName: data.displayName },
      {
        username: data.username,
        fullName: data.fullName,
        photoUrl: data.photoUrl,
        bio: data.bio,
        websiteUrl: data.websiteUrl,
        location: data.location,
        birthday: data.birthday,
        languageCode: data.languageCode,
        timezone: data.timezone,
        preferences: data.preferences,
      },
    );
    const full = await this.usersService.findByIdWithProfile(created!.id);
    if (!full) {
      throw new InternalServerErrorException('User creation failed');
    }
    const { passwordHash: _, ...safe } = full;
    return safe;
  }

  /** Server-side bulk import from CSV/JSON (admin). Preserves row order in `rows`. */
  async bulkImportUsersFromFile(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing or empty file');
    }
    const text = file.buffer.toString('utf8');
    const parsed = parseImportFileContent(file.originalname || 'upload.csv', text);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.fileError);
    }

    const seenEmails = new Set<string>();
    type Classified =
      | { kind: 'invalid'; email: string; message: string }
      | { kind: 'valid'; row: AdminImportPayload };

    const classified: Classified[] = [];
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const label = `Row ${i + 1}`;
      const fieldErr = validatePayloadRow(row, label);
      if (fieldErr) {
        classified.push({ kind: 'invalid', email: row.email?.trim() || '(no email)', message: fieldErr });
        continue;
      }
      const key = row.email!.trim().toLowerCase();
      if (seenEmails.has(key)) {
        classified.push({
          kind: 'invalid',
          email: row.email!,
          message: `${label}: duplicate email (already in this file)`,
        });
        continue;
      }
      seenEmails.add(key);
      classified.push({
        kind: 'valid',
        row: { ...row, email: key },
      });
    }

    const rows: Array<{
      email: string;
      status: 'created' | 'skipped' | 'error';
      userId?: string;
      message?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const c of classified) {
      if (c.kind === 'invalid') {
        failed++;
        rows.push({ email: c.email, status: 'error', message: c.message });
        continue;
      }
      try {
        const u = await this.createUserWithProfileAsAdmin({
          email: c.row.email,
          password: c.row.password,
          displayName: c.row.displayName,
          username: c.row.username,
          fullName: c.row.fullName,
          photoUrl: c.row.photoUrl,
          bio: c.row.bio,
          websiteUrl: c.row.websiteUrl,
          location: c.row.location,
          birthday: c.row.birthday,
          languageCode: c.row.languageCode,
          timezone: c.row.timezone,
          preferences: c.row.preferences,
        });
        created++;
        rows.push({ email: c.row.email, status: 'created', userId: u.id });
      } catch (e) {
        if (e instanceof ConflictException) {
          skipped++;
          rows.push({
            email: c.row.email,
            status: 'skipped',
            message: e.message,
          });
        } else {
          failed++;
          rows.push({
            email: c.row.email,
            status: 'error',
            message: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      }
    }

    return { created, failed, skipped, rows };
  }

  private async issueTokenAndSession(
    user: { id: string; email: string } & Record<string, unknown>,
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload, { expiresIn: JWT_EXPIRY });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.sessionsService.createSession(user.id, access_token, expiresAt);

    const { passwordHash: _, ...userSafe } = user;
    return {
      access_token,
      user: userSafe as AuthResult['user'],
    };
  }

  async impersonate(
    adminId: string,
    targetUserId: string,
  ): Promise<AuthResult & { backToAdminToken: string }> {
    const admin = await this.usersService.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new UnauthorizedException('Admin access required');
    }

    const targetUser = await this.usersService.findByIdWithProfile(targetUserId);
    if (!targetUser) {
      throw new UnauthorizedException('Target user not found');
    }

    const impersonationPayload: JwtPayload = {
      sub: targetUser.id,
      email: targetUser.email,
      impersonatedBy: adminId,
    };
    const access_token = this.jwtService.sign(impersonationPayload, {
      expiresIn: JWT_EXPIRY,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.sessionsService.createSession(targetUser.id, access_token, expiresAt);

    const backToAdminPayload = { sub: adminId, purpose: 'back_to_admin' as const };
    const backToAdminToken = this.jwtService.sign(backToAdminPayload, {
      expiresIn: BACK_TO_ADMIN_EXPIRY,
    });

    const { passwordHash: _, ...userSafe } = targetUser;
    return {
      access_token,
      user: userSafe as AuthResult['user'],
      backToAdminToken,
    };
  }

  async endImpersonation(backToAdminToken: string): Promise<AuthResult> {
    interface BackToAdminPayload {
      sub: string;
      purpose?: string;
    }
    let payload: BackToAdminPayload;
    try {
      payload = this.jwtService.verify<BackToAdminPayload>(backToAdminToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired restore token. Please log in again.');
    }
    if (payload.purpose !== 'back_to_admin' || !payload.sub) {
      throw new UnauthorizedException('Invalid restore token');
    }

    const admin = await this.usersService.findByIdWithProfile(payload.sub);
    if (!admin || admin.role !== 'admin') {
      throw new UnauthorizedException('Admin account not found');
    }

    return this.issueTokenAndSession(admin);
  }
}
