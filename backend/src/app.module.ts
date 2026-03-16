import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../.env'), join(__dirname, '../.env')],
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
  ],
})
export class AppModule {}
