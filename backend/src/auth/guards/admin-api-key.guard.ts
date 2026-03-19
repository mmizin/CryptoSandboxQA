import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey =
      request.headers['x-admin-api-key'] ?? this.extractBearerKey(request);

    const expectedKey = this.config.get<string>('ADMIN_API_KEY');
    if (!expectedKey || expectedKey.trim() === '') {
      throw new UnauthorizedException(
        'Admin API key not configured. Set ADMIN_API_KEY in .env',
      );
    }
    if (!apiKey || apiKey !== expectedKey.trim()) {
      throw new UnauthorizedException('Invalid admin API key');
    }
    return true;
  }

  private extractBearerKey(request: Request): string | undefined {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return undefined;
    return auth.slice(7).trim() || undefined;
  }
}
