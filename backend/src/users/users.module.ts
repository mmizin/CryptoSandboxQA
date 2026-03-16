import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SessionGuard],
  exports: [UsersService],
})
export class UsersModule {}
