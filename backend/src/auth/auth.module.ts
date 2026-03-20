import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SessionsService } from './sessions.service';
import { SessionGuard } from './session.guard';
import { TwoFactorService } from './two-factor.service';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    MailModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SessionsService,
    TwoFactorService,
    SessionGuard,
    AdminApiKeyGuard,
    AdminGuard,
  ],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
