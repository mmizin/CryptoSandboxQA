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
import { WalletsService } from './wallets.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-wallets')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminWalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/wallets')
  @ApiOperation({ summary: 'List user wallets (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiJsonExample(200, 'Returns user wallets', OA.wallets.list)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async listWallets(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.walletsService.findAllByUser(userId);
  }

  @Get(':userId/wallets/:asset')
  @ApiOperation({ summary: 'Get user wallet by asset (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'asset', description: 'Asset symbol (USD, BTC, ETH)' })
  @ApiJsonExample(200, 'Returns wallet', OA.wallets.row)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User or wallet not found', OA.httpError.notFoundWallet)
  async getWallet(@Param('userId') userId: string, @Param('asset') asset: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const wallet = await this.walletsService.findByUserAndAsset(userId, asset);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
