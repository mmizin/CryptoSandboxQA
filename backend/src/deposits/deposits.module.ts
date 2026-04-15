import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { AdminDepositsController } from './admin-deposits.controller';
import { DepositsService } from './deposits.service';
import { SessionGuard } from '../auth/session.guard';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [WalletsModule, AuthModule, UsersModule, MailModule, PaymentMethodsModule],
  controllers: [DepositsController, AdminDepositsController],
  providers: [DepositsService, SessionGuard],
  exports: [DepositsService],
})
export class DepositsModule {}
