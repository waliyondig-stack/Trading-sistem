import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@flowniaga/domain';
import type { Request } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_READ)
  @ApiOperation({ summary: 'Profil tenant aktif' })
  get(@CurrentTenant() ctx: TenantContext) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        legalEntities: {
          where: { deletedAt: null },
          select: { id: true, name: true, isDefault: true },
        },
      },
    });
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.TENANT_UPDATE)
  @ApiOperation({ summary: 'Ubah profil tenant' })
  async update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTenantDto,
    @Req() req: Request,
  ) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.update({
        where: { id: ctx.tenantId },
        data: { name: dto.name ?? before.name },
      });
      await this.audit.log(
        {
          tenantId: ctx.tenantId,
          userId: user.id,
          action: 'tenant.updated',
          entityType: 'Tenant',
          entityId: ctx.tenantId,
          before: { name: before.name },
          after: { name: t.name },
          correlationId: req.correlationId,
          ip: req.ip,
        },
        tx,
      );
      return t;
    });
    return { id: updated.id, name: updated.name, slug: updated.slug, status: updated.status };
  }
}
