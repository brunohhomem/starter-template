import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { ZodValidationException } from 'nestjs-zod';

/**
 * Pipe global de validação Zod.
 * Usa o `ZodValidationException` do `nestjs-zod` para transformar erros do Zod
 * no formato padrão com `details` por campo (path + message).
 *
 * Pode ser usado como pipe global (usa metatype do parâmetro) ou local (usa schema passado no constructor).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = this.schema ?? (metadata.metatype as ZodSchema | undefined);

    if (!schema || !this.isZodSchema(schema)) {
      return value;
    }

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
