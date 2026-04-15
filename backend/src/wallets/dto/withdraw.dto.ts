import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive, Max } from 'class-validator';
import { WALLET_WITHDRAW_AMOUNT_MAX } from '../../common/validation.constants';

export class WithdrawDto {
  @ApiProperty({ enum: ['USD', 'EUR', 'BTC', 'ETH'], example: 'USD' })
  @IsIn(['USD', 'EUR', 'BTC', 'ETH'])
  asset: string;

  @ApiProperty({
    example: 100,
    minimum: 0,
    exclusiveMinimum: true,
    maximum: WALLET_WITHDRAW_AMOUNT_MAX,
    description: `Strictly positive amount (must be greater than zero); max ${WALLET_WITHDRAW_AMOUNT_MAX.toLocaleString()}.`,
  })
  @IsNumber()
  @IsPositive()
  @Max(WALLET_WITHDRAW_AMOUNT_MAX)
  amount: number;
}
