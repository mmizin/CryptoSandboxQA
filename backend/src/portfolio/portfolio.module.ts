import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService, SessionGuard],
  exports: [PortfolioService],
})
export class PortfolioModule {}
