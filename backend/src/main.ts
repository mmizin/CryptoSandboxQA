import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TickersService } from './tickers/tickers.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = process.env.PORT || 3001;
  await app.listen(port);
  const tickers = app.get(TickersService);
  await tickers.seedInitialPrices();
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap().catch(console.error);
