import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'BTC_USD', description: 'Trading pair (BASE_QUOTE format)' })
  @IsString()
  @Matches(/^[A-Z0-9]+_[A-Z0-9]+$/, { message: 'Symbol must be in BASE_QUOTE format (e.g. BTC_USD)' })
  symbol: string;

  @ApiPropertyOptional({ enum: ['spot', 'futures'], default: 'spot', description: 'Market type' })
  @IsOptional()
  @IsIn(['spot', 'futures'])
  marketType?: string;

  @ApiProperty({ enum: ['buy', 'sell'], example: 'buy' })
  @IsIn(['buy', 'sell'])
  side: string;

  @ApiProperty({ enum: ['limit', 'market'], example: 'limit' })
  @IsIn(['limit', 'market'])
  type: string;

  @ApiProperty({ example: 0.001, minimum: 0 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({ example: 50000, minimum: 0, description: 'Required for limit orders' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({
    enum: ['open', 'filled', 'cancelled'],
    description: 'Initial order status for testing (no counterparty). Default: open',
  })
  @IsOptional()
  @IsIn(['open', 'filled', 'cancelled'])
  initialStatus?: string;
}
