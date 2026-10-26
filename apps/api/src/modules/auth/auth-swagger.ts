import type { Request } from 'express';

export const ERROR_SCHEMA = {
  type: 'object' as const,
  properties: {
    statusCode: { type: 'number' as const },
    error: { type: 'string' as const },
    message: { type: 'string' as const },
    code: { type: 'string' as const },
    requestId: { type: 'string' as const },
    path: { type: 'string' as const },
    timestamp: { type: 'string' as const },
  },
};

export const AUTH_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    user: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' as const },
        email: { type: 'string' as const },
        role: { type: 'string' as const, enum: ['admin', 'user'] },
        mustChangePassword: { type: 'boolean' as const },
        emailVerified: { type: 'boolean' as const },
      },
    },
  },
};

export function getRefreshCookie(req: Request): string {
  const cookieJar = req.cookies as Record<string, string> | undefined;
  return cookieJar?.['refresh_token'] ?? '';
}
