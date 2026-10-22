import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildPinoHttpOptions,
  isRouteExcludedFromRequestLog,
  isValidRequestId,
  redactPaths,
  REQUEST_ID_HEADER,
  resolveRequestId,
  REDACTED_FIELDS,
} from './logger-options';
import type { Env } from '../../config/env.schema';

const validParsedEnv: Env = {
  NODE_ENV: 'development',
  API_PORT: 3001,
  APP_ORIGIN: 'http://localhost:3000',
  TRUST_PROXY_HOPS: 0,
  LOG_LEVEL: 'info',
  SWAGGER_ENABLED: true,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USER: 'app',
  DB_PASSWORD: 'validpassword12345678901234567890',
  DB_NAME: 'app',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: 'validredispass12345678901234567890',
  JWT_ACCESS_SECRET: 'validaccesssecret12345678901234567890123456789012345678901234',
  JWT_REFRESH_SECRET: 'validrefreshsecret12345678901234567890123456789012345678901234',
  COOKIE_SECRET: 'validcookiesecret123456789012345678901234567890123456789012345678',
  ENCRYPTION_KEY: 'ZGV2ZW5jcnlwdGlvbmtleTEyMzQ1Njc4OTAxMjM0NQ==',
};

describe('logger-options', () => {
  describe('isValidRequestId', () => {
    it('aceita alfanumérico, hífen e underscore', () => {
      expect(isValidRequestId('abc123')).toBe(true);
      expect(isValidRequestId('req-with-dash')).toBe(true);
      expect(isValidRequestId('req_with_underscore')).toBe(true);
    });

    it('aceita exatamente 64 caracteres', () => {
      const value = 'a'.repeat(64);
      expect(isValidRequestId(value)).toBe(true);
    });

    it('rejeita vazio, espaços e caracteres especiais', () => {
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('req id')).toBe(false);
      expect(isValidRequestId('req"id')).toBe(false);
      expect(isValidRequestId('req\nid')).toBe(false);
    });

    it('rejeita acima de 64 caracteres', () => {
      expect(isValidRequestId('a'.repeat(65))).toBe(false);
    });
  });

  describe('resolveRequestId', () => {
    it('usa o header x-request-id quando válido', () => {
      expect(resolveRequestId('valid-request-id')).toBe('valid-request-id');
    });

    it('substitui header inválido por um UUID novo', () => {
      const generated = resolveRequestId('invalid id with spaces');
      expect(generated).not.toBe('invalid id with spaces');
      expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('gera UUID quando o header está ausente', () => {
      const generated = resolveRequestId(undefined);
      expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('genReqId do buildPinoHttpOptions', () => {
    it('repassa id válido e devolve o header x-request-id', () => {
      const options = buildPinoHttpOptions(validParsedEnv);
      const genReqId = options.genReqId as (req: IncomingMessage, res: ServerResponse) => string;

      const request = {
        headers: { [REQUEST_ID_HEADER]: 'echoed-id-123' },
      } as unknown as IncomingMessage;
      const setHeaders: Array<[string, string]> = [];
      const response = {
        setHeader: (name: string, value: string) => {
          setHeaders.push([name, value]);
        },
      } as unknown as ServerResponse;

      const requestId = genReqId(request, response);

      expect(requestId).toBe('echoed-id-123');
      expect(setHeaders).toContainEqual(['x-request-id', 'echoed-id-123']);
    });

    it('gera id novo e devolve o header quando o recebido é inválido', () => {
      const options = buildPinoHttpOptions(validParsedEnv);
      const genReqId = options.genReqId as (req: IncomingMessage, res: ServerResponse) => string;

      const request = {
        headers: { [REQUEST_ID_HEADER]: '<script>alert(1)</script>' },
      } as unknown as IncomingMessage;
      const setHeaders: Array<[string, string]> = [];
      const response = {
        setHeader: (name: string, value: string) => {
          setHeaders.push([name, value]);
        },
      } as unknown as ServerResponse;

      const requestId = genReqId(request, response);

      expect(requestId).not.toContain('<script>');
      expect(setHeaders).toContainEqual(['x-request-id', requestId]);
    });
  });

  describe('redação', () => {
    it('rediga headers de credenciais e campos sensíveis', () => {
      expect(redactPaths).toContain('req.headers.authorization');
      expect(redactPaths).toContain('req.headers.cookie');
      expect(redactPaths).toContain('res.headers["set-cookie"]');
      expect(redactPaths).toContain('req.body.password');
      expect(redactPaths).toContain('req.body.token');
      expect(redactPaths).toContain('req.body.refreshToken');
      expect(redactPaths).toContain('req.body.secret');
    });

    it('aplica a redação com censor no pino-http', () => {
      const options = buildPinoHttpOptions(validParsedEnv);
      const redact = options.redact as { paths: string[]; censor: string };
      expect(redact.paths).toEqual(redactPaths);
      expect(redact.censor).toBe(REDACTED_FIELDS);
    });
  });

  describe('formato por ambiente', () => {
    it('usa pino-pretty em desenvolvimento', () => {
      const options = buildPinoHttpOptions(validParsedEnv);
      const transport = options.transport as { target: string };
      expect(transport.target).toBe('pino-pretty');
    });

    it('usa JSON (sem transport) em produção', () => {
      const options = buildPinoHttpOptions({ ...validParsedEnv, NODE_ENV: 'production' });
      expect(options.transport).toBeUndefined();
    });

    it('fica silencioso em teste', () => {
      const options = buildPinoHttpOptions({ ...validParsedEnv, NODE_ENV: 'test' });
      expect(options.level).toBe('silent');
    });
  });

  describe('rotas fora do log automático', () => {
    it('exclui /api/health e /api/docs', () => {
      expect(isRouteExcludedFromRequestLog('/api/health')).toBe(true);
      expect(isRouteExcludedFromRequestLog('/api/health/')).toBe(true);
      expect(isRouteExcludedFromRequestLog('/api/docs')).toBe(true);
      expect(isRouteExcludedFromRequestLog('/api/docs/')).toBe(true);
    });

    it('mantém outras rotas no log', () => {
      expect(isRouteExcludedFromRequestLog('/api/users')).toBe(false);
      expect(isRouteExcludedFromRequestLog('/api/docs-json')).toBe(false);
      expect(isRouteExcludedFromRequestLog(undefined)).toBe(false);
    });

    it('a exclusão é aplicada no autoLogging', () => {
      const options = buildPinoHttpOptions(validParsedEnv);
      const autoLogging = options.autoLogging as { ignore: (req: IncomingMessage) => boolean };
      expect(autoLogging.ignore({ url: '/api/health' } as IncomingMessage)).toBe(true);
      expect(autoLogging.ignore({ url: '/api/users' } as IncomingMessage)).toBe(false);
    });
  });
});
