import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import type { Request } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { BranchService } from './branch.service';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BRANCH_READ)
  @ApiOperation({ summary: 'Daftar cabang (sesuai scope membership)' })
  list(@CurrentTenant() ctx: TenantContext) {
    return this.branchService.list(ctx);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BRANCH_READ)
  @ApiOperation({ summary: 'Detail cabang' })
  get(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.getById(ctx, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BRANCH_CREATE)
  @ApiOperation({ summary: 'Buat cabang baru' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBranchDto,
    @Req() req: Request,
  ) {
    return this.branchService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BRANCH_UPDATE)
  @ApiOperation({ summary: 'Ubah cabang' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: Request,
  ) {
    return this.branchService.update(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BRANCH_DELETE)
  @ApiOperation({ summary: 'Hapus cabang (soft delete)' })
  remove(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.branchService.remove(ctx, actor(user, req), id);
  }
}
