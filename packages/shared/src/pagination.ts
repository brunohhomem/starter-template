import * as zod from 'zod';

export const paginationQuerySchema = zod.object({
  page: zod.coerce.number().int().positive().default(1),
  pageSize: zod.coerce.number().int().positive().max(100).default(20),
  sortBy: zod.string().optional(),
  sortOrder: zod.enum(['asc', 'desc']).optional(),
});

export type PaginationQuery = zod.infer<typeof paginationQuerySchema>;

export function paginatedResponseSchema<T extends zod.ZodTypeAny>(itemSchema: T) {
  return zod.object({
    items: zod.array(itemSchema),
    meta: zod.object({
      page: zod.number().int().positive(),
      pageSize: zod.number().int().positive(),
      totalItems: zod.number().int().nonnegative(),
      totalPages: zod.number().int().nonnegative(),
    }),
  });
}

export type PaginatedResponse<T> = {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export function buildPageMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): { page: number; pageSize: number; totalItems: number; totalPages: number } {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}
