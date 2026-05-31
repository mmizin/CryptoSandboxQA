import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { SetOrderStatusDto } from './dto/set-order-status.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, SessionGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiJsonExample(201, 'Returns created order', OA.orders.order)
  async create(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Body() dto: CreateOrderDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy } as Record<string, unknown>
      : undefined;
    return this.ordersService.create(
      user.id,
      {
      symbol: dto.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
      stopPrice: dto.stopPrice,
      marketType: dto.marketType,
      initialStatus: dto.initialStatus,
    },
    auditMetadata,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Set order status (testing)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: SetOrderStatusDto })
  @ApiJsonExample(200, 'Returns updated order', OA.orders.order)
  async setStatus(
    @CurrentUser() user: { id: string; impersonatedBy?: string },
    @Param('id') orderId: string,
    @Body() dto: SetOrderStatusDto,
  ) {
    const auditMetadata =
      user.impersonatedBy ?
        { performedByAdmin: true, adminId: user.impersonatedBy }
      : undefined;
    return this.ordersService.setStatus(user.id, orderId, dto.status, auditMetadata);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiJsonExample(200, 'Returns cancelled order', OA.orders.order)
  async cancel(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.cancel(user.id, orderId);
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiQuery({ name: 'marketType', required: false, description: 'Filter by market: spot or futures' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiJsonExample(200, 'Returns filtered orders', OA.orders.list)
  async list(
    @CurrentUser() user: { id: string },
    @Query('marketType') marketType?: string,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.findByUser(user.id, {
      marketType,
      status,
      symbol,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Orders by date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiJsonExample(200, 'Orders in date range', OA.orders.list)
  async byDate(
    @CurrentUser() user: { id: string },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.findByUser(user.id, { from, to, limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined });
  }

  @Get('by-coin')
  @ApiOperation({ summary: 'Orders by coin/symbol' })
  @ApiQuery({ name: 'symbol', required: true })
  @ApiJsonExample(200, 'Orders for symbol', OA.orders.list)
  async byCoin(
    @CurrentUser() user: { id: string },
    @Query('symbol') symbol: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.findByUser(user.id, { symbol, limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiJsonExample(200, 'Returns order', OA.orders.order)
  async get(@CurrentUser() user: { id: string }, @Param('id') orderId: string) {
    return this.ordersService.findById(user.id, orderId);
  }
}
