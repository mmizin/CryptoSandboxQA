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
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
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
  @ApiJsonExample(200, 'Returns payment methods', OA.paymentMethods.list)
  async list(@CurrentUser() user: { id: string }) {
    return this.paymentMethodsService.findAllByUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add payment method' })
  @ApiBody({ type: CreatePaymentMethodDto })
  @ApiJsonExample(201, 'Returns created payment method', OA.paymentMethods.row)
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(user.id, {
      type: dto.type,
      maskedDetails: dto.maskedDetails,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove payment method' })
  @ApiParam({ name: 'id' })
  @ApiJsonExample(200, 'Removed', OA.paymentMethods.deleteSuccess)
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.paymentMethodsService.delete(user.id, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set default payment method' })
  @ApiParam({ name: 'id' })
  @ApiJsonExample(200, 'Updated default flag', OA.paymentMethods.row)
  async setDefault(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.paymentMethodsService.setDefault(user.id, id);
  }
}
