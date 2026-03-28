import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EMAIL_MAX_LENGTH } from '../../common/validation.constants';

/**
 * DTO for PUT /users/:id (admin) - full replace, core fields required.
 */
export class AdminReplaceUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  displayName: string;

  @ApiProperty({ example: 'user@example.com', maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({ example: 'user', enum: ['user', 'admin'] })
  @IsString()
  @IsIn(['user', 'admin'])
  role: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'Crypto enthusiast' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'John Smith' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'https://mysite.com' })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'New York, US' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @ApiPropertyOptional({ example: 'en', maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  languageCode?: string;

  @ApiPropertyOptional({ example: 'America/New_York', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: { theme: 'dark', notifications: true } })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
