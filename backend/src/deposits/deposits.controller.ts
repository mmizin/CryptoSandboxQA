import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DepositsService } from './deposits.service';
import { DepositFiatDto } from './dto/deposit-fiat.dto';
import { DepositCryptoDto } from './dto/deposit-crypto.dto';
import { AddressRequestDto } from './dto/address-request.dto';

@ApiTags('deposits')
@ApiBearerAuth()
@Controller('deposits')
@UseGuards(JwtAuthGuard, SessionGuard)
export class DepositsController {
  constructor(private depositsService: DepositsService) {}

  @Post('fiat')
  @ApiOperation({ summary: 'Deposit fiat (USD/EUR)' })
  @ApiBody({ type: DepositFiatDto })
  @ApiResponse({ status: 201, description: 'Deposit created and balance updated' })
  async depositFiat(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: DepositFiatDto,
  ) {
    const auditMetadata = user.impersonatedBy
      ? { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.depositsService.depositFiat(user.id, {
      fiatCurrency: dto.fiatCurrency,
      amount: dto.amount,
      paymentMethodId: dto.paymentMethodId,
      auditMetadata,
    });
  }

  @Get('fiat')
  @ApiOperation({ summary: 'List fiat deposits' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiResponse({ status: 200 })
  async listFiat(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.depositsService.listFiatDeposits(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from,
      to,
    });
  }

  @Get('fiat/:id')
  @ApiOperation({ summary: 'Get fiat deposit by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async getFiat(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.depositsService.getFiatDeposit(user.id, id);
  }

  @Post('crypto/address')
  @ApiOperation({ summary: 'Get wallet address for crypto deposit (mock)' })
  @ApiBody({ type: AddressRequestDto })
  @ApiResponse({ status: 200 })
  async getCryptoAddress(@CurrentUser() user: { id: string }, @Body() dto: AddressRequestDto) {
    return this.depositsService.getCryptoDepositAddress(user.id, dto.symbol);
  }

  @Post('crypto')
  @ApiOperation({ summary: 'Create crypto deposit (credits balance in sandbox)' })
  @ApiBody({ type: DepositCryptoDto })
  @ApiResponse({ status: 201 })
  async depositCrypto(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: DepositCryptoDto,
  ) {
    const auditMetadata = user.impersonatedBy
      ? { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.depositsService.depositCrypto(user.id, {
      symbol: dto.symbol,
      amount: dto.amount,
      walletAddress: dto.walletAddress,
      txHash: dto.txHash,
      auditMetadata,
    });
  }

  @Get('crypto')
  @ApiOperation({ summary: 'List crypto deposits' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200 })
  async listCrypto(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.depositsService.listCryptoDeposits(user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('crypto/:id')
  @ApiOperation({ summary: 'Get crypto deposit by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async getCrypto(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.depositsService.getCryptoDeposit(user.id, id);
  }
}
