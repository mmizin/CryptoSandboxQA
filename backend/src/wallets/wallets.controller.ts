import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
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

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit (training mode)' })
  @ApiBody({ type: DepositDto })
  @ApiJsonExample(201, 'Training credit: deposit row + updated balance + ledger entry', OA.wallets.creditDebit)
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
  @ApiJsonExample(201, 'Updated balance and withdraw ledger entry', OA.wallets.debit)
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
