import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination';

export enum CustomerTypeInput {
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
}

export enum CustomerStatusInput {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ConsentStatusInput {
  UNKNOWN = 'UNKNOWN',
  OPTED_IN = 'OPTED_IN',
  OPTED_OUT = 'OPTED_OUT',
}

export enum IdentityTypeInput {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  MARKETPLACE_ACCOUNT = 'MARKETPLACE_ACCOUNT',
  WHATSAPP = 'WHATSAPP',
  MANUAL_REFERENCE = 'MANUAL_REFERENCE',
}

export class CreateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerTypeInput, default: CustomerTypeInput.INDIVIDUAL })
  @IsOptional()
  @IsEnum(CustomerTypeInput)
  type?: CustomerTypeInput;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @ApiPropertyOptional({ example: 'budi@contoh.id' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ConsentStatusInput })
  @IsOptional()
  @IsEnum(ConsentStatusInput)
  consentStatus?: ConsentStatusInput;

  @ApiPropertyOptional({ default: 'id' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'whatsapp' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredChannel?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {
  declare displayName: string; // tetap wajib bila dikirim — dibuat opsional lewat PartialDto di bawah
}

// PATCH memakai semua field opsional:
export class PatchCustomerDto {
  @ApiPropertyOptional({ enum: CustomerTypeInput })
  @IsOptional()
  @IsEnum(CustomerTypeInput)
  type?: CustomerTypeInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ConsentStatusInput })
  @IsOptional()
  @IsEnum(ConsentStatusInput)
  consentStatus?: ConsentStatusInput;

  @ApiPropertyOptional({ enum: CustomerStatusInput })
  @IsOptional()
  @IsEnum(CustomerStatusInput)
  status?: CustomerStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredChannel?: string;
}

export class CustomerListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari nama/telepon/email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: CustomerTypeInput })
  @IsOptional()
  @IsEnum(CustomerTypeInput)
  type?: CustomerTypeInput;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'MERGED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'MERGED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'MERGED';

  @ApiPropertyOptional({ enum: ['displayName', 'createdAt', 'updatedAt'], default: 'displayName' })
  @IsOptional()
  @IsIn(['displayName', 'createdAt', 'updatedAt'])
  sortBy?: 'displayName' | 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

export class AddIdentityDto {
  @ApiProperty({ enum: IdentityTypeInput })
  @IsEnum(IdentityTypeInput)
  identityType!: IdentityTypeInput;

  @ApiProperty({ example: '0812-3456-7890', description: 'Nilai apa adanya; dinormalisasi server' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value!: string;

  @ApiPropertyOptional({ description: 'Kanal asal (mis. mock marketplace)' })
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional({ description: 'ID akun eksternal pada kanal' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: ['UNVERIFIED', 'VERIFIED'], default: 'UNVERIFIED' })
  @IsOptional()
  @IsIn(['UNVERIFIED', 'VERIFIED'])
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED';
}

export class AddAddressDto {
  @ApiPropertyOptional({ default: 'Utama' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  recipientName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ example: 'Jl. Melati No. 10 RT 02/RW 05' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressLine!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiProperty({ example: 'Jakarta Pusat' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: 'DKI Jakarta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  province!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'ID' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ReviewCandidateDto {
  @ApiProperty({ enum: ['CONFIRMED_DUPLICATE', 'REJECTED', 'IGNORED'] })
  @IsIn(['CONFIRMED_DUPLICATE', 'REJECTED', 'IGNORED'])
  status!: 'CONFIRMED_DUPLICATE' | 'REJECTED' | 'IGNORED';
}

export class MergePreviewDto {
  @ApiProperty({ description: 'Customer yang dipertahankan (master)' })
  @IsUUID()
  targetCustomerId!: string;

  @ApiProperty({ description: 'Customer yang digabungkan (source, akan ditandai MERGED)' })
  @IsUUID()
  sourceCustomerId!: string;

  @ApiPropertyOptional({
    description:
      'Field yang diambil dari SOURCE (selain itu nilai target dipertahankan). Contoh: ["primaryPhone","notes"]',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(
    [
      'displayName',
      'firstName',
      'lastName',
      'companyName',
      'primaryPhone',
      'primaryEmail',
      'notes',
      'preferredLanguage',
      'preferredChannel',
      'consentStatus',
      'type',
    ],
    { each: true },
  )
  keepFromSource?: string[];
}

export class MergeExecuteDto extends MergePreviewDto {
  @ApiProperty({ example: 'Nomor telepon sama; dikonfirmasi pelanggan yang sama.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
