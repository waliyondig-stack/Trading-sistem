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
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouse.dto';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WAREHOUSE_READ)
  @ApiOperation({ summary: 'Daftar gudang (sesuai scope membership)' })
  list(@CurrentTenant() ctx: TenantContext) {
    return this.warehouseService.list(ctx);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_READ)
  @ApiOperation({ summary: 'Detail gudang' })
  get(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouseService.getById(ctx, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WAREHOUSE_CREATE)
  @ApiOperation({ summary: 'Buat gudang baru' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWarehouseDto,
    @Req() req: Request,
  ) {
    return this.warehouseService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_UPDATE)
  @ApiOperation({ summary: 'Ubah gudang' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
    @Req() req: Request,
  ) {
    return this.warehouseService.update(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_DELETE)
  @ApiOperation({ summary: 'Hapus gudang (soft delete)' })
  remove(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.warehouseService.remove(ctx, actor(user, req), id);
  }
}
