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
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
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
  @ApiJsonExample(200, 'Returns payment methods', OA.paymentMethods.list)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async listPaymentMethods(@Param('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.paymentMethodsService.findAllByUser(userId);
  }

  @Get(':userId/payment-methods/:id')
  @ApiOperation({ summary: 'Get user payment method by ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'id', description: 'Payment method ID' })
  @ApiJsonExample(200, 'Returns payment method', OA.paymentMethods.row)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User or payment method not found', OA.httpError.notFound)
  async getPaymentMethod(@Param('userId') userId: string, @Param('id') id: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const pm = await this.paymentMethodsService.findByUserAndId(userId, id);
    if (!pm) throw new NotFoundException('Payment method not found');
    return pm;
  }
}
