import { Module } from '@nestjs/common';
import { PeopleRepository } from './people.repository';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';

@Module({
  controllers: [PeopleController],
  providers: [PeopleRepository, PeopleService],
  exports: [PeopleRepository],
})
export class PeopleModule {}
