import { Global, Module } from '@nestjs/common';
import { WORKER_ENV, getWorkerEnv } from './worker-env.js';

@Global()
@Module({
  providers: [{ provide: WORKER_ENV, useFactory: getWorkerEnv }],
  exports: [WORKER_ENV],
})
export class ConfigModule {}
