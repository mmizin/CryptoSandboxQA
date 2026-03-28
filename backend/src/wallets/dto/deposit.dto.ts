import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive, Max } from 'class-validator';
import { WALLET_DEPOSIT_AMOUNT_MAX } from '../../common/validation.constants';

export class DepositDto {
  @ApiProperty({ enum: ['USD', 'EUR', 'BTC', 'ETH'], example: 'USD' })
  @IsIn(['USD', 'EUR', 'BTC', 'ETH'])
  asset: string;

  @ApiProperty({
    example: 100,
    minimum: 0,
    maximum: WALLET_DEPOSIT_AMOUNT_MAX,
    description: `Positive amount; max ${WALLET_DEPOSIT_AMOUNT_MAX.toLocaleString()} (aligned with dashboard client validation).`,
  })
  @IsNumber()
  @IsPositive()
  @Max(WALLET_DEPOSIT_AMOUNT_MAX)
  amount: number;
}
