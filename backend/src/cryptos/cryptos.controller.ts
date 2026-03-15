import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'Returns cryptos and total count' })
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
}
