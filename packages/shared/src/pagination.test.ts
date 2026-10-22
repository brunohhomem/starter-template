import { describe, it, expect } from 'vitest';
import {
  paginationQuerySchema,
  paginatedResponseSchema,
  buildPageMeta,
  type PaginationQuery,
  type PaginatedResponse,
} from './pagination';
import * as zod from 'zod';

describe('pagination schemas', () => {
  describe('paginationQuerySchema', () => {
    it('parses with defaults', () => {
      const result = paginationQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20, sortBy: undefined, sortOrder: undefined });
    });

    it('parses explicit values', () => {
      const result = paginationQuerySchema.parse({
        page: '3',
        pageSize: '50',
        sortBy: 'name',
        sortOrder: 'desc',
      });
      expect(result).toEqual({ page: 3, pageSize: 50, sortBy: 'name', sortOrder: 'desc' });
    });

    it('coerces string numbers', () => {
      const result = paginationQuerySchema.parse({ page: '2', pageSize: '10' });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('rejects page < 1', () => {
      expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => paginationQuerySchema.parse({ page: -1 })).toThrow();
    });

    it('rejects pageSize < 1', () => {
      expect(() => paginationQuerySchema.parse({ pageSize: 0 })).toThrow();
    });

    it('rejects pageSize > 100', () => {
      expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
    });

    it('rejects invalid sortOrder', () => {
      expect(() => paginationQuerySchema.parse({ sortOrder: 'invalid' })).toThrow();
    });

    it('accepts valid sortOrder', () => {
      const asc = paginationQuerySchema.parse({ sortOrder: 'asc' });
      const desc = paginationQuerySchema.parse({ sortOrder: 'desc' });
      expect(asc.sortOrder).toBe('asc');
      expect(desc.sortOrder).toBe('desc');
    });
  });

  describe('paginatedResponseSchema', () => {
    const itemSchema = zod.object({ id: zod.string(), name: zod.string() });
    const responseSchema = paginatedResponseSchema(itemSchema);

    it('parses valid response', () => {
      const input = {
        items: [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ],
        meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
      };
      const result = responseSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('rejects invalid items', () => {
      const input = {
        items: [{ id: '1' }],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      };
      expect(() => responseSchema.parse(input)).toThrow();
    });

    it('rejects invalid meta', () => {
      const input = {
        items: [{ id: '1', name: 'A' }],
        meta: { page: 1, pageSize: 20, totalItems: -1, totalPages: 1 },
      };
      expect(() => responseSchema.parse(input)).toThrow();
    });
  });

  describe('buildPageMeta', () => {
    it('calculates totalPages correctly', () => {
      expect(buildPageMeta(1, 20, 0)).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      });
      expect(buildPageMeta(1, 20, 1)).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      });
      expect(buildPageMeta(1, 20, 20)).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 20,
        totalPages: 1,
      });
      expect(buildPageMeta(1, 20, 21)).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2,
      });
      expect(buildPageMeta(2, 20, 41)).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 41,
        totalPages: 3,
      });
      expect(buildPageMeta(3, 10, 25)).toEqual({
        page: 3,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
      });
    });
  });

  describe('types', () => {
    it('types are inferred correctly', () => {
      const query: PaginationQuery = { page: 1, pageSize: 20, sortBy: 'name', sortOrder: 'asc' };
      const response: PaginatedResponse<{ id: string }> = {
        items: [{ id: '1' }],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      };
      expect(query).toBeDefined();
      expect(response).toBeDefined();
    });
  });
});
