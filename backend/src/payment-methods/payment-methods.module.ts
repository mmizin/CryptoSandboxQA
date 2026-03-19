import { Module } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { AdminPaymentMethodsController } from './admin-payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { SessionGuard } from '../auth/session.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PaymentMethodsController, AdminPaymentMethodsController],
  providers: [PaymentMethodsService, SessionGuard],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
