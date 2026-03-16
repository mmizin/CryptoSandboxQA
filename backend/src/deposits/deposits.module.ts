import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { SessionGuard } from '../auth/session.guard';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  controllers: [DepositsController],
  providers: [DepositsService, SessionGuard],
  exports: [DepositsService],
})
export class DepositsModule {}
