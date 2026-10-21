import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import type { Env } from '../../config/env.schema';

export const REQUEST_ID_HEADER = 'x-request-id';

export const REDACTED_FIELDS = '[REDACTED]';

/**
 * Caminhos redigidos em toda linha de log de HTTP: headers de credencial e
 * campos de corpo que carregam segredos.
 */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.secret',
];

/**
 * Valida um request id recebido: alfanumérico, hífen ou underscore, até 64
 * caracteres. Impede header poisoning com quebras de linha ou scripts.
 */
export function isValidRequestId(value: string): boolean {
  return /^[a-zA-Z0-9-_]{1,64}$/.test(value);
}

/**
 * Extrai o request id do header `x-request-id` quando válido; senão gera um
 * UUID novo. O id reaproveitado vale para o log e para a resposta de erro.
 */
export function resolveRequestId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === 'string' && isValidRequestId(headerValue)) {
    return headerValue;
  }
  return crypto.randomUUID();
}

/**
 * Rotas excluídas do log automático de requisições para não poluir a saída
 * com chamadas de sondagem (health) e documentação (docs).
 */
export function isRouteExcludedFromRequestLog(url: string | undefined): boolean {
  if (url === '/api/health' || url === '/api/health/') {
    return true;
  }
  return url === '/api/docs' || (url?.startsWith('/api/docs/') ?? false);
}

/**
 * Opções do pino-http a partir do ambiente validado:
 * - desenvolvimento: saída legível com pino-pretty;
 * - produção: JSON puro, um objeto por linha;
 * - teste: silencioso para não sujar a saída dos testes.
 */
export function buildPinoHttpOptions(env: Env): Options {
  const isDevelopment = env.NODE_ENV === 'development';
  const isTest = env.NODE_ENV === 'test';
  const level = isTest ? 'silent' : env.LOG_LEVEL;

  return {
    level,
    redact: {
      paths: redactPaths,
      censor: REDACTED_FIELDS,
    },
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, requestId);
      return requestId;
    },
    autoLogging: {
      ignore: (req: IncomingMessage) => isRouteExcludedFromRequestLog(req.url),
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,req.headers',
          },
        }
      : undefined,
    quietReqLogger: true,
  };
}
