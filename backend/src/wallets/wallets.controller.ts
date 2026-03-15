import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WalletsService } from './wallets.service';
import { DepositDto } from './dto/deposit.dto';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.walletsService.findAllByUser(user.id);
  }

  @Get(':asset')
  async get(@CurrentUser() user: { id: string }, @Param('asset') asset: string) {
    return this.walletsService.getOrCreate(user.id, asset);
  }

  @Post('deposit')
  async deposit(@CurrentUser() user: { id: string }, @Body() dto: DepositDto) {
    return this.walletsService.credit(user.id, dto.asset, dto.amount);
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: { id: string }, @Body() dto: DepositDto) {
    return this.walletsService.debit(user.id, dto.asset, dto.amount);
  }
}
