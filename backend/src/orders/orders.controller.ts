import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: 'Returns created order' })
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
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Returns cancelled order' })
  async cancel(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.cancel(user.id, orderId);
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiResponse({ status: 200, description: 'Returns filtered orders' })
  async list(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.ordersService.findByUser(user.id, { status, symbol });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Returns order' })
  async get(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.findById(user.id, orderId);
  }
}
