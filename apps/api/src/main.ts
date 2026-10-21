import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config';

async function bootstrap(): Promise<void> {
  // Validar ambiente ANTES de criar a aplicação
  const env = loadEnv();

  const application = await NestFactory.create(AppModule);
  await application.listen(env.API_PORT);
}

void bootstrap();
