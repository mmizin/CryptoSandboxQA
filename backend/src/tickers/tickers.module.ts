import { Module } from '@nestjs/common';
import { TickersService } from './tickers.service';

@Module({
  providers: [TickersService],
  exports: [TickersService],
})
export class TickersModule {}
