import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import type { Request } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { MemberService } from './member.service';
import { InviteMemberDto, UpdateMemberDto } from './member.dto';
import { PrismaService } from '../prisma/prisma.service';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

@ApiTags('members')
@ApiBearerAuth()
@Controller()
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('members')
  @RequirePermissions(PERMISSIONS.MEMBER_READ)
  @ApiOperation({ summary: 'Daftar anggota tenant' })
  list(@CurrentTenant() ctx: TenantContext) {
    return this.memberService.list(ctx);
  }

  @Post('members')
  @RequirePermissions(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Tambah anggota (buat user baru bila belum terdaftar)' })
  invite(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteMemberDto,
    @Req() req: Request,
  ) {
    return this.memberService.invite(ctx, actor(user, req), dto);
  }

  @Patch('members/:id')
  @RequirePermissions(PERMISSIONS.MEMBER_UPDATE)
  @ApiOperation({ summary: 'Ubah role/status/scope anggota' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: Request,
  ) {
    return this.memberService.update(ctx, actor(user, req), id, dto);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Daftar role tenant beserta permission' })
  async roles(@CurrentTenant() ctx: TenantContext) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: ctx.tenantId },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((p) => p.permissionCode),
    }));
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Katalog permission global' })
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }
}
