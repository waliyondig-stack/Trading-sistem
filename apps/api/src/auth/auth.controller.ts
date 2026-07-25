import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { AuthOnly, CurrentUser, Public } from '../common/decorators';
import type { RequestUser } from '../common/request-types';

function meta(req: Request) {
  return {
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrasi pemilik usaha baru (membuat tenant baru)' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Masuk dengan email dan kata sandi' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Tukar refresh token dengan access token baru (rotasi)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, meta(req));
  }

  @AuthOnly()
  @ApiBearerAuth()
  @HttpCode(204)
  @Post('logout')
  @ApiOperation({ summary: 'Keluar (mencabut refresh token)' })
  async logout(@Body() dto: RefreshDto, @CurrentUser() user: RequestUser, @Req() req: Request) {
    await this.authService.logout(dto.refreshToken, user.id, meta(req));
  }

  @AuthOnly()
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Profil pengguna beserta membership tenant' })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.id);
  }
}
