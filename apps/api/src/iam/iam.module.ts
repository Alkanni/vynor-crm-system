import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActorContextService } from './actor-context.service.js';
import { AuthGuard } from './auth.guard.js';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { PermissionGuard } from './permission.guard.js';
import { PolicyService } from './policy.service.js';

@Global()
@Module({
  providers: [
    JwtVerifierService,
    ActorContextService,
    PolicyService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [JwtVerifierService, ActorContextService, PolicyService],
})
export class IamModule {}
