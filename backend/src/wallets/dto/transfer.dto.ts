import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsPositive, IsString, Max, MaxLength, MinLength } from 'class-validator';
import { EMAIL_MAX_LENGTH, WALLET_WITHDRAW_AMOUNT_MAX } from '../../common/validation.constants';

export class TransferDto {
  @ApiProperty({
    example: 'BTC',
    description: 'Cryptocurrency asset symbol; must match an active asset with asset_type crypto.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  asset: string;

  @ApiProperty({
    example: 0.5,
    minimum: 0,
    exclusiveMinimum: true,
    maximum: WALLET_WITHDRAW_AMOUNT_MAX,
    description: `Strictly positive amount; max ${WALLET_WITHDRAW_AMOUNT_MAX.toLocaleString()}.`,
  })
  @IsNumber()
  @IsPositive()
  @Max(WALLET_WITHDRAW_AMOUNT_MAX)
  amount: number;

  @ApiProperty({
    example: 'peer@example.com',
    description: 'Registered user email of the recipient (case-insensitive).',
  })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  toEmail: string;
}
