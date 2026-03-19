import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SessionsService } from './sessions.service';
import { TwoFactorService } from './two-factor.service';

export interface JwtPayload {
  sub: string;
  email: string;
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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private sessionsService: SessionsService,
    private twoFactorService: TwoFactorService,
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
}
