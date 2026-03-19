import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaymentMethodsService } from './payment-methods.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-payment-methods')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminPaymentMethodsController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/payment-methods')
  @ApiOperation({ summary: 'List user payment methods (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns payment methods' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async listPaymentMethods(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.paymentMethodsService.findAllByUser(userId);
  }

  @Get(':userId/payment-methods/:id')
  @ApiOperation({ summary: 'Get user payment method by ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'id', description: 'Payment method ID' })
  @ApiResponse({ status: 200, description: 'Returns payment method' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User or payment method not found' })
  async getPaymentMethod(@Param('userId') userId: string, @Param('id') id: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const pm = await this.paymentMethodsService.findByUserAndId(userId, id);
    if (!pm) throw new NotFoundException('Payment method not found');
    return pm;
  }
}
