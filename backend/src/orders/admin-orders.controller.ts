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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'Returns filtered orders' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiResponse({ status: 200, description: 'Returns order' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'User or order not found' })
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
