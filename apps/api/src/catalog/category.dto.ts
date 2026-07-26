import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export enum CatalogStatusInput {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Minuman' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'minuman', description: 'Otomatis dari nama bila kosong' })
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/, { message: 'slug tidak valid' })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/, { message: 'slug tidak valid' })
  slug?: string;

  @ApiPropertyOptional({ description: 'null untuk memindah ke root', nullable: true })
  @IsOptional()
  @IsUUID()
  parentCategoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: CatalogStatusInput })
  @IsOptional()
  @IsEnum(CatalogStatusInput)
  status?: CatalogStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
