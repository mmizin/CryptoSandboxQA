import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, SessionGuard],
  exports: [TransactionsService],
})
export class TransactionsModule {}
