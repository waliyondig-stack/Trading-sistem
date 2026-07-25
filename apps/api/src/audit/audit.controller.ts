import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PERMISSIONS } from '@flowniaga/domain';
import { CurrentTenant, RequirePermissions } from '../common/decorators';
import type { TenantContext } from '../common/request-types';
import { PaginationQueryDto, pageArgs, paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Daftar audit log tenant (terbaru dulu)' })
  async list(@CurrentTenant() ctx: TenantContext, @Query() query: AuditQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where = {
      tenantId: ctx.tenantId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(rows, total, page, pageSize);
  }
}
