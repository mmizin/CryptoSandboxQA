import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { TransactionsService } from './transactions.service';
import { SessionGuard } from '../auth/session.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TransactionsController, AdminTransactionsController],
  providers: [TransactionsService, SessionGuard],
  exports: [TransactionsService],
})
export class TransactionsModule {}
