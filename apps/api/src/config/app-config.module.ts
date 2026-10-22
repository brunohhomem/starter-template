import { Global, Module } from '@nestjs/common';
import { getEnv } from './load-env';

export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Readonly<ReturnType<typeof getEnv>> => {
        const env = getEnv();
        return Object.freeze(env);
      },
    },
  ],
  exports: [ENV],
})
export class AppConfigModule {}
