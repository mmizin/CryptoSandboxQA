import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrdersService } from './orders.service';
import { UsersService } from '../users/users.service';

@ApiTags('admin-orders')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':userId/orders')
  @ApiOperation({ summary: 'List user orders (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'marketType', required: false, description: 'Filter by market: spot or futures' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status (open, filled, cancelled)' })
  @ApiQuery({ name: 'symbol', required: false, description: 'Filter by trading pair (e.g. BTC_USD)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Skip N results for pagination' })
  @ApiJsonExample(200, 'Returns filtered orders', OA.orders.list)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async listOrders(
    @Param('userId') userId: string,
    @Query('marketType') marketType?: string,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.ordersService.findByUser(userId, {
      marketType,
      status,
      symbol,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':userId/orders/:orderId')
  @ApiOperation({ summary: 'Get user order by ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiJsonExample(200, 'Returns order', OA.orders.order)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(404, 'User or order not found', OA.httpError.notFound)
  async getOrder(
    @Param('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const order = await this.ordersService.findById(userId, orderId);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
