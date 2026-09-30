import { Global, Module } from '@nestjs/common';
import { API_ENV, getApiEnv } from './api-env.js';

@Global()
@Module({
  providers: [{ provide: API_ENV, useFactory: getApiEnv }],
  exports: [API_ENV],
})
export class ConfigModule {}
