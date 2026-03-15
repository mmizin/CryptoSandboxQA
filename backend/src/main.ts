import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppModule } from './app.module';
import { TickersService } from './tickers/tickers.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Test Exchange API')
    .setDescription('Crypto exchange training platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter.getType() === 'express') {
    const expressApp = httpAdapter.getInstance();
    expressApp.get('/api/docs-json', (_req: Request, res: Response) => res.json(document));
  }
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000';
  const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length > 1 ? origins : origins[0],
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
