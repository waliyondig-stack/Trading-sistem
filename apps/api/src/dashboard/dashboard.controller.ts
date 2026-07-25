import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import { CurrentTenant, RequirePermissions } from '../common/decorators';
import type { TenantContext } from '../common/request-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dashboard shell Fase 1: ringkasan organisasi + aktivitas terakhir.
 * Metrik bisnis (omzet, pesanan, stok kritis, pembayaran mismatch)
 * menyusul saat modul terkait dibangun (Fase 3-4).
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @ApiOperation({ summary: 'Ringkasan dashboard tenant' })
  async summary(@CurrentTenant() ctx: TenantContext) {
    const tenantId = ctx.tenantId;
    const [tenant, branchCount, warehouseCount, memberCount, recentActivity] =
      await this.prisma.$transaction([
        this.prisma.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { id: true, name: true, slug: true },
        }),
        this.prisma.branch.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.warehouse.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.membership.count({ where: { tenantId, status: 'ACTIVE', deletedAt: null } }),
        this.prisma.auditLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        }),
      ]);

    return {
      tenant,
      generatedAt: new Date().toISOString(),
      counts: {
        branches: branchCount,
        warehouses: warehouseCount,
        activeMembers: memberCount,
      },
      // Placeholder metrik bisnis — diisi ketika modul order/inventory/payment hadir.
      metrics: {
        revenueToday: null,
        newOrdersToday: null,
        criticalStockItems: null,
        unmatchedPayments: null,
        note: 'Metrik bisnis tersedia mulai Fase 3 (Order & Inventory) dan Fase 4 (Payment).',
      },
      recentActivity,
    };
  }
}
