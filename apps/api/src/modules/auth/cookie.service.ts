import { Injectable } from '@nestjs/common';
import { Response } from 'express';

export interface CookieConfig {
  secure: boolean;
  accessTtlMinutes: number;
  refreshTtlDays: number;
}

@Injectable()
export class CookieService {
  constructor(private readonly config: CookieConfig) {}

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const { secure, accessTtlMinutes, refreshTtlDays } = this.config;

    // Access token cookie - available on all paths
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: accessTtlMinutes * 60 * 1000,
    });

    // Refresh token cookie - only available on /api/auth path
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response): void {
    const { secure } = this.config;

    res.clearCookie('access_token', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
    });
  }

  getAccessToken(req: { cookies?: Record<string, string> }): string | undefined {
    return req.cookies?.access_token;
  }

  getRefreshToken(req: { cookies?: Record<string, string> }): string | undefined {
    return req.cookies?.refresh_token;
  }
}
