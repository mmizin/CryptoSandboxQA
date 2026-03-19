import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletsService } from './wallets.service';
import { DepositDto } from './dto/deposit.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard, SessionGuard)
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'List all wallets' })
  @ApiResponse({ status: 200, description: 'Returns user wallets' })
  async list(@CurrentUser() user: { id: string }) {
    return this.walletsService.findAllByUser(user.id);
  }

  @Get(':asset')
  @ApiOperation({ summary: 'Get wallet by asset' })
  @ApiParam({ name: 'asset', description: 'Asset symbol (USD, BTC, ETH)' })
  @ApiResponse({ status: 200, description: 'Returns wallet' })
  async get(@CurrentUser() user: { id: string }, @Param('asset') asset: string) {
    return this.walletsService.getOrCreate(user.id, asset);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit (training mode)' })
  @ApiBody({ type: DepositDto })
  @ApiResponse({ status: 201, description: 'Returns updated wallet' })
  async deposit(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: DepositDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.walletsService.credit(user.id, dto.asset, dto.amount, {
      auditMetadata,
    });
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw' })
  @ApiBody({ type: DepositDto })
  @ApiResponse({ status: 201, description: 'Returns updated wallet' })
  async withdraw(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: DepositDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.walletsService.debit(user.id, dto.asset, dto.amount, {
      auditMetadata,
    });
  }
}
