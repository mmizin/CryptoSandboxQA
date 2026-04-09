import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TransactionsService } from './transactions.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-transactions')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/transactions')
  @ApiOperation({ summary: 'Unified transaction history (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by type (deposit, withdraw, etc)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiJsonExample(200, 'Returns transaction history', OA.transactions.unified)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getTransactions(
    @Param('userId') userId: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.transactionsService.getTransactions(userId, {
      type,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':userId/transactions/deposits')
  @ApiOperation({ summary: 'Deposit history (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiJsonExample(200, 'Returns deposit history', OA.transactions.deposits)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getDeposits(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.transactionsService.getDepositHistory(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from,
      to,
    });
  }

  @Get(':userId/transactions/trades')
  @ApiOperation({ summary: 'Trading history (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiJsonExample(200, 'Returns trade history', OA.transactions.trades)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getTrades(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.transactionsService.getTradeHistory(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from,
      to,
    });
  }

  @Get(':userId/transactions/withdrawals')
  @ApiOperation({ summary: 'Withdrawal history (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiJsonExample(200, 'Returns withdrawal history', OA.transactions.withdrawals)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getWithdrawals(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.transactionsService.getWithdrawalHistory(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
