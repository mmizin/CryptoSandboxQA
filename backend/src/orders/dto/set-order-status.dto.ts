import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SetOrderStatusDto {
  @ApiProperty({ enum: ['open', 'filled', 'cancelled'], description: 'Target status (testing only)' })
  @IsIn(['open', 'filled', 'cancelled'])
  status: string;
}
