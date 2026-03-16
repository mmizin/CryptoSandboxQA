import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive } from 'class-validator';

export class DepositDto {
  @ApiProperty({ enum: ['USD', 'EUR', 'BTC', 'ETH'], example: 'USD' })
  @IsIn(['USD', 'EUR', 'BTC', 'ETH'])
  asset: string;

  @ApiProperty({ example: 100, minimum: 0 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
