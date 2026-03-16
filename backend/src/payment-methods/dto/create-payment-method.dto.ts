import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: ['card', 'sepa', 'applepay'] })
  @IsIn(['card', 'sepa', 'applepay'])
  type: 'card' | 'sepa' | 'applepay';

  @ApiProperty({
    example: { last4: '4242', brand: 'visa' },
    description: 'Masked payment details for display',
  })
  @IsObject()
  maskedDetails: Record<string, unknown>;
}
