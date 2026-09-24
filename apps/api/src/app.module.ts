import { Module } from '@nestjs/common';
import { IamModule } from './iam/index.js';

@Module({
  imports: [IamModule],
})
export class AppModule {}
