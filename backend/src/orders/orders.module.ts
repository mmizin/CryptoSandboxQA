import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MatchingService } from './matching.service';
import { SessionGuard } from '../auth/session.guard';
import { WalletsModule } from '../wallets/wallets.module';
import { TickersModule } from '../tickers/tickers.module';

@Module({
  imports: [WalletsModule, TickersModule],
  controllers: [OrdersController],
  providers: [OrdersService, MatchingService, SessionGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
