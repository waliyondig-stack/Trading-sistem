import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'kasir@tokosaya.id' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ description: 'ID role tenant yang diberikan' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ description: 'Nama (wajib bila user belum terdaftar)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Kata sandi awal (wajib bila user belum terdaftar)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  initialPassword?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allBranches?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Daftar branch ID bila akses dibatasi' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}

export enum MemberStatusInput {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: MemberStatusInput })
  @IsOptional()
  @IsEnum(MemberStatusInput)
  status?: MemberStatusInput;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allBranches?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}
