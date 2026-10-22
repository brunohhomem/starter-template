import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService, AccessTokenPayload } from './token.service';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;

  const accessSecret = 'test-access-secret-12345678901234567890123456789012345678901234';
  const accessTtlMinutes = 15;
  const refreshTtlDays = 7;
  const refreshReuseGraceSeconds = 10;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: TokenService,
          useFactory: (jwt: JwtService) =>
            new TokenService(
              accessSecret,
              accessTtlMinutes,
              refreshTtlDays,
              refreshReuseGraceSeconds,
              jwt,
            ),
          inject: [JwtService],
        },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('signAccess', () => {
    it('gera access token válido com payload correto', () => {
      const user = { id: 'user-123', role: 'user' };
      const sessionId = 'session-456';
      const mustChangePassword = false;

      const token = tokenService.signAccess(user, sessionId, mustChangePassword);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT tem 3 partes
    });

    it('token contém claims esperadas', async () => {
      const user = { id: 'user-123', role: 'admin' };
      const sessionId = 'session-456';
      const mustChangePassword = true;

      const token = tokenService.signAccess(user, sessionId, mustChangePassword);
      const decoded = jwtService.decode(token) as AccessTokenPayload & { iat: number; exp: number };

      expect(decoded.sub).toBe(user.id);
      expect(decoded.role).toBe(user.role);
      expect(decoded.sid).toBe(sessionId);
      expect(decoded.mcp).toBe(mustChangePassword);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('token expira no tempo configurado', async () => {
      const user = { id: 'user-123', role: 'user' };
      const sessionId = 'session-456';

      const token = tokenService.signAccess(user, sessionId, false);
      const decoded = jwtService.decode(token) as { exp: number };

      const expDate = new Date(decoded.exp * 1000);
      const now = new Date();
      const diffMinutes = (expDate.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(14);
      expect(diffMinutes).toBeLessThanOrEqual(16);
    });
  });

  describe('verifyAccess', () => {
    it('verifica token válido retorna payload', async () => {
      const user = { id: 'user-123', role: 'user' };
      const sessionId = 'session-456';

      const token = tokenService.signAccess(user, sessionId, false);
      const result = await tokenService.verifyAccess(token);

      expect(result.error).toBeUndefined();
      expect(result.payload).not.toBeNull();
      expect(result.payload?.sub).toBe(user.id);
      expect(result.payload?.sid).toBe(sessionId);
    });

    it('token expirado retorna error expired', async () => {
      // Criar token com exp no passado
      const expiredToken = jwtService.sign(
        { sub: 'user-123', role: 'user', sid: 'session-456', mcp: false },
        { secret: accessSecret, expiresIn: '-1h', algorithm: 'HS256' },
      );

      const result = await tokenService.verifyAccess(expiredToken);

      expect(result.error).toBe('expired');
      expect(result.payload).toBeNull();
    });

    it('token inválido retorna error invalid', async () => {
      const invalidToken = 'invalid.token.string';

      const result = await tokenService.verifyAccess(invalidToken);

      expect(result.error).toBe('invalid');
      expect(result.payload).toBeNull();
    });

    it('token com secret errado retorna error invalid', async () => {
      const wrongSecretToken = jwtService.sign(
        { sub: 'user-123', role: 'user', sid: 'session-456', mcp: false },
        { secret: 'wrong-secret', expiresIn: '1h', algorithm: 'HS256' },
      );

      const result = await tokenService.verifyAccess(wrongSecretToken);

      expect(result.error).toBe('invalid');
      expect(result.payload).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('gera par token/hash', () => {
      const { token, hash } = tokenService.generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex
    });

    it('hash corresponde ao token gerado', () => {
      const { token, hash } = tokenService.generateRefreshToken();
      const computedHash = tokenService.hashRefreshToken(token);

      expect(computedHash).toBe(hash);
    });

    it('tokens diferentes geram hashes diferentes', () => {
      const { token: token1, hash: hash1 } = tokenService.generateRefreshToken();
      const { token: token2, hash: hash2 } = tokenService.generateRefreshToken();

      expect(token1).not.toBe(token2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashRefreshToken', () => {
    it('hash determinístico para mesmo token', () => {
      const token = 'test-refresh-token-12345678901234567890';
      const hash1 = tokenService.hashRefreshToken(token);
      const hash2 = tokenService.hashRefreshToken(token);

      expect(hash1).toBe(hash2);
    });

    it('hash SHA-256 hex de 64 caracteres', () => {
      const token = 'test-token';
      const hash = tokenService.hashRefreshToken(token);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('tokens diferentes produzem hashes diferentes', () => {
      const hash1 = tokenService.hashRefreshToken('token-1');
      const hash2 = tokenService.hashRefreshToken('token-2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
