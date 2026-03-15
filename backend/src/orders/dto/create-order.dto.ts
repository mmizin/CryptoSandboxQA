import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateOrderDto {
  @IsIn(['BTC_USD', 'ETH_USD'])
  symbol: string;

  @IsIn(['buy', 'sell'])
  side: string;

  @IsIn(['limit', 'market'])
  type: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}
