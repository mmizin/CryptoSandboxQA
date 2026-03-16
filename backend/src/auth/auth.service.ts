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
  user: { id: string; email: string; displayName: string | null };
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

    return this.issueTokenAndSession(user);
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

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash: _, ...userSafe } = user;
    return this.issueTokenAndSession(userSafe);
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

  private async issueTokenAndSession(user: {
    id: string;
    email: string;
    displayName: string | null;
  }): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload, { expiresIn: JWT_EXPIRY });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.sessionsService.createSession(user.id, access_token, expiresAt);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}
