import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { AdminWalletsController } from './admin-wallets.controller';
import { WalletsService } from './wallets.service';
import { SessionGuard } from '../auth/session.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [WalletsController, AdminWalletsController],
  providers: [WalletsService, SessionGuard],
  exports: [WalletsService],
})
export class WalletsModule {}
