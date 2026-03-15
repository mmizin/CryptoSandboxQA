import { IsIn, IsNumber, IsPositive } from 'class-validator';

export class DepositDto {
  @IsIn(['USD', 'BTC', 'ETH'])
  asset: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
