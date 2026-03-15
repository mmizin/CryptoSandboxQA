import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, {
      symbol: dto.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
    });
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.cancel(user.id, orderId);
  }

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.ordersService.findByUser(user.id, { status, symbol });
  }

  @Get(':id')
  async get(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.findById(user.id, orderId);
  }
}
