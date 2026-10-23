import { Module } from '@nestjs/common';
import { MaintenanceProcessor } from './maintenance.processor';
import { LoggingModule } from '../../common/logging/logger.module';

@Module({
  imports: [LoggingModule.forRoot()],
  providers: [MaintenanceProcessor],
  exports: [],
})
export class MaintenanceModule {}
