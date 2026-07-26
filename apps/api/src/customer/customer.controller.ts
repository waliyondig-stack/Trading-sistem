import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { CustomerService } from './customer.service';
import { MergeService } from './merge.service';
import {
  AddAddressDto,
  AddIdentityDto,
  CreateCustomerDto,
  CustomerListQueryDto,
  MergeExecuteDto,
  MergePreviewDto,
  PatchCustomerDto,
  ReviewCandidateDto,
} from './customer.dto';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

class UpdateIdentityDto {
  @IsOptional()
  @IsIn(['UNVERIFIED', 'VERIFIED'])
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly mergeService: MergeService,
  ) {}

  // ------------------------- CRUD -------------------------

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'Daftar/cari pelanggan' })
  list(@CurrentTenant() ctx: TenantContext, @Query() query: CustomerListQueryDto) {
    return this.customerService.list(ctx, query);
  }

  @Get('merge-candidates')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MERGE_REVIEW)
  @ApiOperation({ summary: 'Daftar kandidat duplikat (default: PENDING)' })
  @ApiQuery({ name: 'status', required: false })
  candidates(@CurrentTenant() ctx: TenantContext, @Query('status') status?: string) {
    return this.customerService.listCandidates(ctx, status);
  }

  @Get('merge-history')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MERGE_REVIEW)
  @ApiOperation({ summary: 'Riwayat merge pelanggan' })
  @ApiQuery({ name: 'customerId', required: false })
  history(@CurrentTenant() ctx: TenantContext, @Query('customerId') customerId?: string) {
    return this.mergeService.history(ctx, customerId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_READ)
  @ApiOperation({ summary: 'Detail pelanggan (identitas, alamat, indikator duplikat)' })
  detail(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.getById(ctx, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMER_CREATE)
  @ApiOperation({ summary: 'Buat pelanggan (telepon/email dinormalisasi otomatis)' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customerService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Ubah pelanggan' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchCustomerDto,
    @Req() req: Request,
  ) {
    return this.customerService.update(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_DELETE)
  @ApiOperation({ summary: 'Arsipkan pelanggan (soft delete)' })
  archive(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.customerService.archive(ctx, actor(user, req), id);
  }

  // ------------------------- Identity & Address -------------------------

  @Post(':id/identities')
  @RequirePermissions(PERMISSIONS.CUSTOMER_IDENTITY_MANAGE)
  @ApiOperation({ summary: 'Tambah identitas kanal pelanggan' })
  addIdentity(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIdentityDto,
    @Req() req: Request,
  ) {
    return this.customerService.addIdentity(ctx, actor(user, req), id, dto);
  }

  @Patch('identities/:identityId')
  @RequirePermissions(PERMISSIONS.CUSTOMER_IDENTITY_MANAGE)
  @ApiOperation({ summary: 'Ubah status verifikasi / primary identitas' })
  updateIdentity(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('identityId', ParseUUIDPipe) identityId: string,
    @Body() dto: UpdateIdentityDto,
    @Req() req: Request,
  ) {
    return this.customerService.updateIdentity(ctx, actor(user, req), identityId, dto);
  }

  @Post(':id/addresses')
  @RequirePermissions(PERMISSIONS.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Tambah alamat pelanggan' })
  addAddress(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAddressDto,
    @Req() req: Request,
  ) {
    return this.customerService.addAddress(ctx, actor(user, req), id, dto);
  }

  // ------------------------- Duplicate & Merge -------------------------

  @Patch('merge-candidates/:candidateId')
  @RequirePermissions(PERMISSIONS.CUSTOMER_MERGE_REVIEW)
  @ApiOperation({ summary: 'Review kandidat duplikat (konfirmasi/tolak/abaikan)' })
  reviewCandidate(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: ReviewCandidateDto,
    @Req() req: Request,
  ) {
    return this.customerService.reviewCandidate(ctx, actor(user, req), candidateId, dto.status);
  }

  @Post('merge/preview')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CUSTOMER_MERGE_REVIEW)
  @ApiOperation({ summary: 'Preview hasil merge dua pelanggan (tanpa mengubah data)' })
  mergePreview(@CurrentTenant() ctx: TenantContext, @Body() dto: MergePreviewDto) {
    return this.mergeService.preview(ctx, dto);
  }

  @Post('merge/execute')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CUSTOMER_MERGE_EXECUTE)
  @ApiOperation({ summary: 'Eksekusi merge (atomic, dengan history + audit)' })
  mergeExecute(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: MergeExecuteDto,
    @Req() req: Request,
  ) {
    return this.mergeService.execute(ctx, actor(user, req), dto);
  }
}
