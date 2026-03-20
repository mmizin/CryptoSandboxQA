import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, ValidateIf } from 'class-validator';

export class BulkExportUsersQueryDto {
  @ApiProperty({ enum: ['first100', 'last100', 'dateRange'] })
  @IsIn(['first100', 'last100', 'dateRange'])
  preset!: 'first100' | 'last100' | 'dateRange';

  @ApiPropertyOptional({
    description: 'Required when preset=dateRange. Inclusive start (ISO 8601 date or datetime).',
  })
  @ValidateIf((o: BulkExportUsersQueryDto) => o.preset === 'dateRange')
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Required when preset=dateRange. Inclusive end (ISO 8601 date or datetime).',
  })
  @ValidateIf((o: BulkExportUsersQueryDto) => o.preset === 'dateRange')
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
