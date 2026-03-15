import { Module } from '@nestjs/common';
import { TickersModule } from '../tickers/tickers.module';
import { TickerGateway } from './ticker.gateway';

@Module({
  imports: [TickersModule],
  providers: [TickerGateway],
})
export class WebSocketModule {}
