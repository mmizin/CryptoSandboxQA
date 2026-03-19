import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { AdminPortfolioController } from './admin-portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SessionGuard } from '../auth/session.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PortfolioController, AdminPortfolioController],
  providers: [PortfolioService, SessionGuard],
  exports: [PortfolioService],
})
export class PortfolioModule {}
