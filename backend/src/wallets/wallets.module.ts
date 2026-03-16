import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, SessionGuard],
  exports: [WalletsService],
})
export class WalletsModule {}
