import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { AuthOnly, CurrentUser, Public } from '../common/decorators';
import type { RequestUser } from '../common/request-types';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './session-cookies';

function meta(req: Request) {
  return {
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

function refreshTokenFrom(req: Request, dto?: RefreshDto): string | undefined {
  return dto?.refreshToken ?? (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrasi pemilik usaha baru (membuat tenant baru)' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, meta(req));
    const csrfToken = setAuthCookies(res, result);
    return { ...result, csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  @ApiOperation({
    summary: 'Masuk — session di cookie httpOnly; body juga memuat token untuk klien API',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, meta(req));
    const csrfToken = setAuthCookies(res, result);
    return { ...result, csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotasi refresh token (dari cookie httpOnly atau body)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshTokenFrom(req, dto);
    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token tidak ditemukan.',
      });
    }
    const tokens = await this.authService.refresh(token, meta(req));
    const csrfToken = setAuthCookies(res, tokens);
    return { ...tokens, csrfToken };
  }

  @AuthOnly()
  @ApiBearerAuth()
  @HttpCode(204)
  @Post('logout')
  @ApiOperation({ summary: 'Keluar — mencabut refresh token dan menghapus session cookie' })
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshTokenFrom(req, dto);
    if (token) {
      await this.authService.logout(token, user.id, meta(req));
    }
    clearAuthCookies(res);
  }

  @AuthOnly()
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Profil pengguna beserta membership tenant' })
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user.id);
  }
}
