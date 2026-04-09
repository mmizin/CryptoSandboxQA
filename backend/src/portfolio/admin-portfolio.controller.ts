import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PortfolioService } from './portfolio.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-portfolio')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminPortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/portfolio/balances')
  @ApiOperation({ summary: 'Get user balances (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiJsonExample(200, 'Returns user balances', OA.portfolio.balances)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getBalances(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.portfolioService.getBalances(userId);
  }

  @Get(':userId/portfolio/summary')
  @ApiOperation({ summary: 'Get user portfolio summary (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiJsonExample(200, 'Returns portfolio summary with total value', OA.portfolio.summary)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getSummary(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.portfolioService.getSummary(userId);
  }

  @Get(':userId/portfolio/allocation')
  @ApiOperation({ summary: 'Get user asset allocation (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiJsonExample(200, 'Returns asset allocation percentages', OA.portfolio.allocation)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getAllocation(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.portfolioService.getAllocation(userId);
  }
}
