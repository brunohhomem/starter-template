import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodIssue } from 'zod';
import { errorResponseSchema, type ErrorResponse } from '@starter/shared';

/**
 * Filtro global de exceções.
 * - HttpException (incluindo ZodValidationException) → 400 com details
 * - Qualquer outro erro → 500 genérico sem stack/mensagem interna em produção
 * Toda resposta de erro obedece ao `errorResponseSchema` do shared.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = request.headers['x-request-id'] as string;
    const path = request.url;

    let status: number;
    let error: string;
    let message: string;
    let code: string | undefined;
    let details: ErrorResponse['details'];

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Validation failed';
      const zodError = exception.getZodError() as { issues: ZodIssue[] };
      details = zodError.issues.map((issue: ZodIssue) => ({
        path: issue.path as (string | number)[],
        message: issue.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const responseObj =
        typeof exceptionResponse === 'object' ? (exceptionResponse as Record<string, unknown>) : {};
      error = (responseObj.error as string | undefined) ?? exception.message;
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (responseObj.message?.toString() ?? exception.message);
      code = responseObj.code as string | undefined;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'An unexpected error occurred';

      // Loga o erro real com requestId para rastreabilidade
      this.logger.error({
        message: 'Unhandled exception',
        requestId,
        path,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      error,
      message,
      ...(code && { code }),
      requestId,
      path,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    };

    // Validação defensiva: garante que a resposta segue o contrato
    const parseResult = errorResponseSchema.safeParse(errorResponse);
    if (!parseResult.success) {
      // Se o próprio contrato falhou, algo está muito errado
      this.logger.error({
        message: 'Error response failed schema validation',
        requestId,
        path,
        issues: parseResult.error.issues,
      });
    }

    response.status(status).json(errorResponse);
  }
}
