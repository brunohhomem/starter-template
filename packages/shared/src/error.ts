import * as zod from 'zod';

export const errorDetailSchema = zod.object({
  path: zod.array(zod.union([zod.string(), zod.number()])),
  message: zod.string(),
});

export const errorResponseSchema = zod.object({
  statusCode: zod.number().int().positive(),
  error: zod.string(),
  message: zod.string(),
  code: zod.string().optional(),
  details: zod.array(errorDetailSchema).optional(),
  requestId: zod.string(),
  path: zod.string(),
  timestamp: zod.string().datetime({ offset: true }),
});

export type ErrorResponse = zod.infer<typeof errorResponseSchema>;
export type ErrorDetail = zod.infer<typeof errorDetailSchema>;
