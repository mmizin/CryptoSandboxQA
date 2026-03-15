import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { OrdersModule } from './orders/orders.module';
import { TickersModule } from './tickers/tickers.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';

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
    OrdersModule,
    WebSocketModule,
  ],
})
export class AppModule {}
