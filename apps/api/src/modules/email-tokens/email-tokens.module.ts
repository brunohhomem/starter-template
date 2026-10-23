import { Module } from '@nestjs/common';
import { EmailTokensRepository } from './email-tokens.repository';
import { EmailTokensService } from './email-tokens.service';

@Module({
  providers: [EmailTokensRepository, EmailTokensService],
  exports: [EmailTokensRepository, EmailTokensService],
})
export class EmailTokensModule {}
