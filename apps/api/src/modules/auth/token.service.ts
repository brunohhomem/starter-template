import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  sid: string;
  mcp: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPair {
  token: string;
  hash: string;
}

@Injectable()
export class TokenService {
  public readonly accessTtlMinutes: number;
  public readonly refreshTtlDays: number;
  public readonly accessSecret: string;
  public readonly refreshReuseGraceSeconds: number;

  constructor(
    accessSecret: string,
    accessTtlMinutes: number,
    refreshTtlDays: number,
    refreshReuseGraceSeconds: number = 10,
    private readonly jwtService: JwtService = new JwtService(),
  ) {
    this.accessSecret = accessSecret;
    this.accessTtlMinutes = accessTtlMinutes;
    this.refreshTtlDays = refreshTtlDays;
    this.refreshReuseGraceSeconds = refreshReuseGraceSeconds;
  }

  signAccess(
    user: { id: string; role: string },
    sessionId: string,
    mustChangePassword: boolean,
  ): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      sid: sessionId,
      mcp: mustChangePassword,
    };
    return this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: `${this.accessTtlMinutes}m`,
      algorithm: 'HS256',
    });
  }

  async verifyAccess(
    token: string,
  ): Promise<{ payload: AccessTokenPayload | null; error?: 'expired' | 'invalid' }> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });
      return { payload };
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'TokenExpiredError' || err.message?.includes('expired')) {
        return { payload: null, error: 'expired' };
      }
      return { payload: null, error: 'invalid' };
    }
  }

  generateRefreshToken(): RefreshTokenPair {
    const token = randomBytes(48).toString('base64url');
    const hash = this.hashRefreshToken(token);
    return { token, hash };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
