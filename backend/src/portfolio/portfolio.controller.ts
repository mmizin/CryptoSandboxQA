import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
@UseGuards(JwtAuthGuard, SessionGuard)
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Get user balances' })
  @ApiJsonExample(200, 'Per-asset balances', OA.portfolio.balances)
  async getBalances(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getBalances(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary with total value' })
  @ApiJsonExample(200, 'Total value and per-asset breakdown in USD', OA.portfolio.summary)
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getSummary(user.id);
  }

  @Get('allocation')
  @ApiOperation({ summary: 'Get asset allocation percentages' })
  @ApiJsonExample(200, 'Allocation percentages by asset', OA.portfolio.allocation)
  async getAllocation(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getAllocation(user.id);
  }
}
