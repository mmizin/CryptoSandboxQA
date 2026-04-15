import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, Max, MaxLength, MinLength } from 'class-validator';
import { WALLET_WITHDRAW_AMOUNT_MAX } from '../../common/validation.constants';

export class WithdrawDto {
  @ApiProperty({
    example: 'BTC',
    description:
      'Cryptocurrency asset symbol. Must match an active asset with asset_type crypto; fiat symbols are rejected.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
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
