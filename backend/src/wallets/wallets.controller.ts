import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletsService } from './wallets.service';
import { TransferDto } from './dto/transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard, SessionGuard)
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'List all wallets' })
  @ApiJsonExample(200, 'Returns user wallets', OA.wallets.list)
  async list(@CurrentUser() user: { id: string }) {
    return this.walletsService.findAllByUser(user.id);
  }

  @Get(':asset')
  @ApiOperation({ summary: 'Get wallet by asset' })
  @ApiParam({ name: 'asset', description: 'Asset symbol (USD, BTC, ETH)' })
  @ApiJsonExample(200, 'Returns wallet', OA.wallets.row)
  async get(@CurrentUser() user: { id: string }, @Param('asset') asset: string) {
    return this.walletsService.getOrCreate(user.id, asset);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer crypto to another user' })
  @ApiBody({ type: TransferDto })
  @ApiJsonExample(201, 'Updated sender balance and internal transfer', OA.wallets.transfer)
  async transfer(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: TransferDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.walletsService.transferCrypto(user.id, dto, {
      auditMetadata,
    });
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw' })
  @ApiBody({ type: WithdrawDto })
  @ApiJsonExample(201, 'Updated balance and withdraw ledger entry', OA.wallets.debit)
  async withdraw(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: WithdrawDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.walletsService.withdrawForUser(user.id, dto.asset, dto.amount, {
      auditMetadata,
    });
  }
}
