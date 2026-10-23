import { Module } from '@nestjs/common';
import { EmailTokensRepository } from './email-tokens.repository';

@Module({
  providers: [EmailTokensRepository],
  exports: [EmailTokensRepository],
})
export class EmailTokensModule {}
