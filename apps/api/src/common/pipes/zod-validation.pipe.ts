import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ZodValidationException } from 'nestjs-zod';

/**
 * Pipe global de validação Zod.
 * Usa o `ZodValidationException` do `nestjs-zod` para transformar erros do Zod
 * no formato padrão com `details` por campo (path + message).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata;

    if (!metatype || !this.isZodSchema(metatype)) {
      return value;
    }

    const schema = metatype as ZodSchema;
    const result = schema.safeParse(value);

    if (!result.success) {
      const zodError = result.error as ZodError;
      throw new ZodValidationException(zodError);
    }

    return result.data;
  }

  private isZodSchema(metatype: unknown): metatype is ZodSchema {
    return typeof metatype === 'object' && metatype !== null && 'safeParse' in metatype;
  }
}
