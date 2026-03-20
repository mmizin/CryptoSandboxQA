import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { OrdersModule } from './orders/orders.module';
import { TickersModule } from './tickers/tickers.module';
import { CryptosModule } from './cryptos/cryptos.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';
import { DepositsModule } from './deposits/deposits.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TransactionsModule } from './transactions/transactions.module';
import { MetricsModule } from './metrics/metrics.module';

/**
 * Loads `.env` from the backend package and repo root. `npm run dev` typically
 * runs with cwd = `backend/`, while `__dirname` is `backend/dist` — both are
 * checked so root `.env` (SMTP, etc.) is never missed. Later paths override
 * earlier ones (Nest ConfigModule).
 */
function nestEnvFilePaths(): string[] {
  const paths: string[] = [];
  const push = (abs: string) => {
    if (existsSync(abs) && !paths.includes(abs)) paths.push(abs);
  };
  push(join(process.cwd(), '.env'));
  push(join(process.cwd(), '..', '.env'));
  push(join(__dirname, '..', '.env'));
  push(join(__dirname, '..', '..', '.env'));
  return paths;
}

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: nestEnvFilePaths(),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletsModule,
    TickersModule,
    CryptosModule,
    OrdersModule,
    WebSocketModule,
    DepositsModule,
    PaymentMethodsModule,
    PortfolioModule,
    TransactionsModule,
    MetricsModule,
  ],
})
export class AppModule {}
