import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EndImpersonationDto {
  @ApiProperty({ description: 'Token to restore admin session' })
  @IsString()
  @IsNotEmpty()
  backToAdminToken: string;
}
