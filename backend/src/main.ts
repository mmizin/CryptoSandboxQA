import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { createOpenApiConfig } from './openapi.config';
import { AppModule } from './app.module';
import { TickersService } from './tickers/tickers.service';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS first so preflight requests succeed
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000';
  const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length > 1 ? origins : origins[0],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Swagger UI and OpenAPI JSON
  const config = createOpenApiConfig();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Explicit route for OpenAPI JSON (http://localhost:3001/api/docs-json)
  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter.getType() === 'express') {
    const expressApp = httpAdapter.getInstance() as { get: (path: string, handler: (req: unknown, res: { json: (x: unknown) => void }) => void) => void };
    expressApp.get('/api/docs-json', (_req, res) => res.json(document));
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  // Seed ticker prices (non-fatal if DB tables missing)
  try {
    const tickers = app.get(TickersService);
    await tickers.seedInitialPrices();
  } catch (err) {
    console.warn('Ticker seed skipped (run prisma migrate if DB not ready):', (err as Error).message);
  }

  console.log(`Backend running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`Frontend: http://localhost:3000`);
}

bootstrap().catch(console.error);
