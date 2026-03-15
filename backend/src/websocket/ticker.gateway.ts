import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TickersService } from '../tickers/tickers.service';

const BROADCAST_INTERVAL_MS = 2000;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' },
  namespace: '/ticker',
})
export class TickerGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private tickersService: TickersService) {}

  afterInit() {
    this.broadcastInterval = setInterval(
      () => this.broadcastTickers(),
      BROADCAST_INTERVAL_MS,
    );
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, symbol: string) {
    const room = `ticker:${symbol}`;
    client.join(room);
    const ticker = await this.tickersService.get(symbol);
    if (ticker) {
      client.emit('ticker', {
        symbol: ticker.symbol,
        lastPrice: Number(ticker.lastPrice),
        volume24h: Number(ticker.volume24h),
      });
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, symbol: string) {
    client.leave(`ticker:${symbol}`);
  }

  private async broadcastTickers() {
    const tickers = await this.tickersService.getAll();
    for (const t of tickers) {
      this.server.to(`ticker:${t.symbol}`).emit('ticker', {
        symbol: t.symbol,
        lastPrice: Number(t.lastPrice),
        volume24h: Number(t.volume24h),
      });
    }
  }
}
