import { Injectable } from '@nestjs/common';
import { Response } from 'express';

export interface CookieConfig {
  secure: boolean;
  refreshTtlDays: number;
}

@Injectable()
export class CookieService {
  constructor(private readonly config: CookieConfig) {}

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const { secure, refreshTtlDays } = this.config;
    const sessionMaxAge = refreshTtlDays * 24 * 60 * 60 * 1000;

    // Access token cookie lifespan matches the session so the middleware never expires
    // it before the client can renew. The JWT inside still expires at AUTH_ACCESS_TTL_MINUTES.
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: sessionMaxAge,
    });

    // Refresh token cookie - only available on /api/auth path
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: sessionMaxAge,
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
