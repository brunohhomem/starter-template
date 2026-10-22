import { Module } from '@nestjs/common';
import { LoggerModule as NestPinoLoggerModule } from 'nestjs-pino';
import type { Env } from '../../config/env.schema';
import { ENV, AppConfigModule } from '../../config/app-config.module';
import { buildPinoHttpOptions } from './logger-options';

/**
 * Integra o pino ao Nest. As opções puras (request id, redação, formato por
 * ambiente) moram em `logger-options.ts`, testável sem subir o framework.
 */
@Module({})
export class LoggingModule {
  static forRoot() {
    return NestPinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      providers: [],
      inject: [ENV],
      useFactory: (env: Env) => ({ pinoHttp: buildPinoHttpOptions(env) }),
    });
  }
}
