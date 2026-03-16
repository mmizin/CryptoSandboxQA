import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@ApiTags('payment-methods')
@ApiBearerAuth()
@Controller('payment-methods')
@UseGuards(JwtAuthGuard, SessionGuard)
export class PaymentMethodsController {
  constructor(private paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List user payment methods' })
  @ApiResponse({ status: 200, description: 'Returns payment methods' })
  async list(@CurrentUser() user: { id: string }) {
    return this.paymentMethodsService.findAllByUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add payment method' })
  @ApiBody({ type: CreatePaymentMethodDto })
  @ApiResponse({ status: 201, description: 'Returns created payment method' })
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(user.id, {
      type: dto.type,
      maskedDetails: dto.maskedDetails,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove payment method' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.paymentMethodsService.delete(user.id, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set default payment method' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async setDefault(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.paymentMethodsService.setDefault(user.id, id);
  }
}
