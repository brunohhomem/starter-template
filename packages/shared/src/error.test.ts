import { describe, it, expect } from 'vitest';
import {
  errorResponseSchema,
  errorDetailSchema,
  type ErrorResponse,
  type ErrorDetail,
} from './error';

describe('error schemas', () => {
  it('errorDetailSchema parses valid detail', () => {
    const input = { path: ['body', 'email'], message: 'Invalid email' };
    const result = errorDetailSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('errorDetailSchema accepts numeric path segments', () => {
    const input = { path: ['items', 0, 'name'], message: 'Required' };
    const result = errorDetailSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('errorDetailSchema rejects missing fields', () => {
    expect(() => errorDetailSchema.parse({ path: ['a'] })).toThrow();
    expect(() => errorDetailSchema.parse({ message: 'x' })).toThrow();
  });

  it('errorResponseSchema parses minimal error', () => {
    const input = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      requestId: 'abc-123',
      path: '/api/test',
      timestamp: '2026-10-21T10:00:00.000Z',
    };
    const result = errorResponseSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('errorResponseSchema parses error with details', () => {
    const input = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: [
        { path: ['body', 'email'], message: 'Invalid email' },
        { path: ['body', 'age'], message: 'Must be positive' },
      ],
      requestId: 'abc-123',
      path: '/api/test',
      timestamp: '2026-10-21T10:00:00.000Z',
    };
    const result = errorResponseSchema.parse(input);
    expect(result).toEqual(input);
  });

  it('errorResponseSchema rejects invalid timestamp', () => {
    const input = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      requestId: 'abc-123',
      path: '/api/test',
      timestamp: 'not-a-date',
    };
    expect(() => errorResponseSchema.parse(input)).toThrow();
  });

  it('errorResponseSchema rejects missing required fields', () => {
    const requiredKeys = [
      'statusCode',
      'error',
      'message',
      'requestId',
      'path',
      'timestamp',
    ] as const;
    const base = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      requestId: 'abc-123',
      path: '/api/test',
      timestamp: '2026-10-21T10:00:00.000Z',
    };
    // Remove each required field
    for (const key of requiredKeys) {
      const rest = { ...base };
      delete rest[key];
      expect(() => errorResponseSchema.parse(rest)).toThrow();
    }
  });

  it('types are inferred correctly', () => {
    // Type-only test - if this compiles, types work
    const detail: ErrorDetail = { path: ['a'], message: 'b' };
    const response: ErrorResponse = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: [detail],
      requestId: 'abc-123',
      path: '/api/test',
      timestamp: '2026-10-21T10:00:00.000Z',
    };
    expect(detail).toBeDefined();
    expect(response).toBeDefined();
  });
});
