import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200 })
  async getBalances(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getBalances(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary with total value' })
  @ApiResponse({ status: 200 })
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getSummary(user.id);
  }

  @Get('allocation')
  @ApiOperation({ summary: 'Get asset allocation percentages' })
  @ApiResponse({ status: 200 })
  async getAllocation(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getAllocation(user.id);
  }
}
