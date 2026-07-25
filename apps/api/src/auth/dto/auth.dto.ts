import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'pemilik@tokosaya.id' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'RahasiaKuat123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Toko Saya', description: 'Nama usaha/tenant yang dibuat' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({
    example: 'toko-saya',
    description: 'Slug unik tenant (huruf kecil, angka, tanda hubung)',
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, {
    message: 'tenantSlug harus huruf kecil/angka/tanda hubung, 3-64 karakter',
  })
  tenantSlug!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.flowniaga.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Opsional untuk klien API; session web memakai cookie httpOnly.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
