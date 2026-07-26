import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CatalogStatusInput } from './category.dto';

export enum ChannelTypeInput {
  MANUAL = 'MANUAL',
  POS = 'POS',
  CSV = 'CSV',
  MOCK_MARKETPLACE = 'MOCK_MARKETPLACE',
  WEBSITE = 'WEBSITE',
  WHATSAPP_PLACEHOLDER = 'WHATSAPP_PLACEHOLDER',
}

export class CreateChannelDto {
  @ApiProperty({ enum: ChannelTypeInput })
  @IsEnum(ChannelTypeInput)
  type!: ChannelTypeInput;

  @ApiProperty({ example: 'Mock Marketplace Utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Metadata non-secret (JANGAN simpan kredensial di sini)' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: CatalogStatusInput })
  @IsOptional()
  @IsEnum(CatalogStatusInput)
  status?: CatalogStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
