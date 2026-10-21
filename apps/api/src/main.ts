import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadEnv } from './config';

async function bootstrap(): Promise<void> {
  // Validar ambiente ANTES de criar a aplicação: sem env válido não há boot.
  const env = loadEnv();

  // bufferLogs segura os logs de bootstrap até o pino estar ativo,
  // para que tudo saia no formato estruturado desde a primeira linha.
  const application = await NestFactory.create(AppModule, { bufferLogs: true });
  application.useLogger(application.get(Logger));

  await application.listen(env.API_PORT);
}

void bootstrap();
