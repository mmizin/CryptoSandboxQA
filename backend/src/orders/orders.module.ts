import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { MatchingService } from './matching.service';
import { SessionGuard } from '../auth/session.guard';
import { WalletsModule } from '../wallets/wallets.module';
import { TickersModule } from '../tickers/tickers.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [WalletsModule, TickersModule, AuthModule, UsersModule, MailModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, MatchingService, SessionGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
