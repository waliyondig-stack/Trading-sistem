import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-JKT-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,20}$/, {
    message: 'code harus alfanumerik/tanda hubung, 2-20 karakter',
  })
  code!: string;

  @ApiProperty({ example: 'Gudang Utama Jakarta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'ID cabang pemilik gudang' })
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
