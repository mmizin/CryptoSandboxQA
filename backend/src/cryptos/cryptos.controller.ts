import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { CryptosService } from './cryptos.service';

@ApiTags('cryptos')
@Controller('cryptos')
export class CryptosController {
  constructor(private cryptosService: CryptosService) {}

  @Get()
  @ApiOperation({ summary: 'List cryptocurrencies with pagination and filters' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items (1-100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by name or symbol' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by: name, symbol, price, change24h, volume24h' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'asc or desc' })
  @ApiJsonExample(200, 'Returns cryptos and total count', OA.cryptos.list)
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.cryptosService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      search,
      sortBy,
      sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
    });
  }

  @Get(':symbol/price-history')
  @ApiOperation({ summary: 'Get price history for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'interval', required: false })
  @ApiJsonExample(200, 'Price history points', OA.cryptos.priceHistory)
  async getPriceHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('interval') interval?: string,
  ) {
    return this.cryptosService.getPriceHistory(symbol, from, to, interval);
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get single cryptocurrency by symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiJsonExample(200, 'Single market listing', OA.cryptos.one)
  @ApiJsonExample(404, 'Crypto not found', OA.httpError.notFound)
  async get(@Param('symbol') symbol: string) {
    return this.cryptosService.findBySymbol(symbol);
  }
}
