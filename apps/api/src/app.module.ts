import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { IamModule } from './iam/index.js';

@Module({
  imports: [IamModule, HealthModule],
})
export class AppModule {}
