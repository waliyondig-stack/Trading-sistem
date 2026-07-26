import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';
import { CatalogStatusInput } from './category.dto';

export enum ProductTypeInput {
  PHYSICAL = 'PHYSICAL',
  SERVICE = 'SERVICE',
  DIGITAL = 'DIGITAL',
  BUNDLE = 'BUNDLE',
}

export class CreateVariantDto {
  @ApiProperty({ example: 'Kopi Gayo 250g' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'KOPI-GAYO-250', description: 'SKU internal, unik per tenant' })
  @IsString()
  @Matches(/^[A-Za-z0-9._/-]{2,64}$/, { message: 'internalSku tidak valid (2-64 karakter)' })
  internalSku!: string;

  @ApiPropertyOptional({ example: '8991234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,64}$/, { message: 'barcode tidak valid (4-64 karakter)' })
  barcode?: string;

  @ApiPropertyOptional({ description: 'Atribut variasi, mis. {"ukuran":"250g"}' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @ApiPropertyOptional({ default: 'pcs' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Harga pokok dalam integer rupiah', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  costAmount?: number;

  @ApiPropertyOptional({ description: 'Harga jual dalam integer rupiah', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ default: 'IDR' })
  @IsOptional()
  @IsIn(['IDR'])
  currency?: string;

  @ApiPropertyOptional({ description: 'Berat dalam gram' })
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @ApiPropertyOptional({ description: 'Dimensi bebas, mis. {"p":10,"l":5,"t":3}' })
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, number>;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,64}$/, { message: 'barcode tidak valid' })
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'Integer rupiah' })
  @IsOptional()
  @IsInt()
  @Min(0)
  costAmount?: number;

  @ApiPropertyOptional({ description: 'Integer rupiah' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, number>;

  @ApiPropertyOptional({ enum: CatalogStatusInput })
  @IsOptional()
  @IsEnum(CatalogStatusInput)
  status?: CatalogStatusInput;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Kopi Arabika Gayo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Otomatis dari nama bila kosong' })
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/, { message: 'slug tidak valid' })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: ProductTypeInput, default: ProductTypeInput.PHYSICAL })
  @IsOptional()
  @IsEnum(ProductTypeInput)
  productType?: ProductTypeInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  taxCategory?: string;

  @ApiPropertyOptional({ default: 'pcs' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultUnit?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom field aman (JSON object)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [CreateVariantDto], description: 'Variasi awal (opsional)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/, { message: 'slug tidak valid' })
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: ProductTypeInput })
  @IsOptional()
  @IsEnum(ProductTypeInput)
  productType?: ProductTypeInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  taxCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultUnit?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: CatalogStatusInput })
  @IsOptional()
  @IsEnum(CatalogStatusInput)
  status?: CatalogStatusInput;
}

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari pada nama/slug/SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: CatalogStatusInput })
  @IsOptional()
  @IsEnum(CatalogStatusInput)
  status?: CatalogStatusInput;

  @ApiPropertyOptional({ enum: ProductTypeInput })
  @IsOptional()
  @IsEnum(ProductTypeInput)
  productType?: ProductTypeInput;

  @ApiPropertyOptional({ enum: ['name', 'createdAt', 'updatedAt'], default: 'name' })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
