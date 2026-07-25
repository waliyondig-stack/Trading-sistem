import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import type { Request, Response } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { ImportService, MAX_FILE_BYTES } from './import.service';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

@ApiTags('catalog-import')
@ApiBearerAuth()
@Controller('catalog-imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_IMPORT_PREVIEW)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Unggah CSV produk dan dapatkan preview (belum menyimpan data)' })
  upload(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('columnMapping') columnMapping: string | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Unggah file CSV pada field "file".',
      });
    }
    return this.importService.createPreview(ctx, actor(user, req), file, columnMapping);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_IMPORT_PREVIEW)
  @ApiOperation({ summary: 'Daftar job import terakhir' })
  list(@CurrentTenant() ctx: TenantContext) {
    return this.importService.listJobs(ctx);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_IMPORT_PREVIEW)
  @ApiOperation({ summary: 'Status/progress job import' })
  status(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.importService.getStatus(ctx, id);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.CATALOG_IMPORT_EXECUTE)
  @ApiOperation({ summary: 'Konfirmasi import (idempotent — header Idempotency-Key opsional)' })
  confirm(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    return this.importService.confirm(ctx, actor(user, req), id, idempotencyKey);
  }

  @Get(':id/errors.csv')
  @RequirePermissions(PERMISSIONS.CATALOG_IMPORT_PREVIEW)
  @ApiOperation({ summary: 'Unduh error report per baris (CSV, aman dari formula injection)' })
  async errorReport(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.importService.errorReportCsv(ctx, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${id}.csv"`);
    res.send(csv);
  }
}
