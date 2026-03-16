import { Module } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService, SessionGuard],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
