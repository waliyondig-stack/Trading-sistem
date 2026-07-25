import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

export enum ListingStatusInput {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateListingDto {
  @ApiProperty()
  @IsUUID()
  channelId!: string;

  @ApiProperty()
  @IsUUID()
  productVariantId!: string;

  @ApiProperty({ example: 'MKT-SKU-001', description: 'SKU eksternal pada kanal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  externalSku!: string;

  @ApiProperty({ example: 'Kopi Gayo 250g — Toko Resmi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  listingName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalVariantId?: string;

  @ApiPropertyOptional({ description: 'Harga di kanal (integer rupiah)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  channelPrice?: number;

  @ApiPropertyOptional({ enum: ListingStatusInput, default: ListingStatusInput.ACTIVE })
  @IsOptional()
  @IsEnum(ListingStatusInput)
  listingStatus?: ListingStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateListingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  externalSku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  listingName?: string;

  @ApiPropertyOptional({ description: 'Pindahkan mapping ke variant lain' })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalVariantId?: string;

  @ApiPropertyOptional({ description: 'Integer rupiah' })
  @IsOptional()
  @IsInt()
  @Min(0)
  channelPrice?: number;

  @ApiPropertyOptional({ enum: ListingStatusInput })
  @IsOptional()
  @IsEnum(ListingStatusInput)
  listingStatus?: ListingStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListingListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiPropertyOptional({ description: 'Cari external SKU / nama listing' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ResolveUnmappedDto {
  @ApiProperty()
  @IsUUID()
  channelId!: string;

  @ApiProperty({ type: [String], description: 'Daftar external SKU untuk diperiksa' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  externalSkus!: string[];
}
