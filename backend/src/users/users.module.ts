import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SessionGuard, AdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
