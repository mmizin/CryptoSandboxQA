import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ enum: ['BTC_USD', 'ETH_USD'], example: 'BTC_USD' })
  @IsIn(['BTC_USD', 'ETH_USD'])
  symbol: string;

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
}
