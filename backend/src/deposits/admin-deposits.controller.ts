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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DepositsService } from './deposits.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-deposits')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminDepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/deposits/fiat')
  @ApiOperation({ summary: 'List user fiat deposits (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Returns fiat deposits' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async listFiatDeposits(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.depositsService.listFiatDeposits(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from,
      to,
    });
  }

  @Get(':userId/deposits/fiat/:id')
  @ApiOperation({ summary: 'Get user fiat deposit by ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'id', description: 'Deposit ID' })
  @ApiResponse({ status: 200, description: 'Returns fiat deposit' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User or deposit not found' })
  async getFiatDeposit(@Param('userId') userId: string, @Param('id') id: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.depositsService.getFiatDeposit(userId, id);
  }

  @Get(':userId/deposits/crypto')
  @ApiOperation({ summary: 'List user crypto deposits (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiResponse({ status: 200, description: 'Returns crypto deposits' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async listCryptoDeposits(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.depositsService.listCryptoDeposits(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':userId/deposits/crypto/:id')
  @ApiOperation({ summary: 'Get user crypto deposit by ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'id', description: 'Deposit ID' })
  @ApiResponse({ status: 200, description: 'Returns crypto deposit' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User or deposit not found' })
  async getCryptoDeposit(@Param('userId') userId: string, @Param('id') id: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.depositsService.getCryptoDeposit(userId, id);
  }
}
