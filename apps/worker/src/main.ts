import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { loadEnvFileIfPresent, validateEnv, WorkerEnvSchema } from '@vynor/contracts';

import { WorkerModule } from './worker.module.js';

// Load local .env if present
loadEnvFileIfPresent();

// FND-011 / FND-017: Validate environment variables on startup.
// Crashes immediately with descriptive diagnostics if configuration is invalid or missing.
validateEnv(WorkerEnvSchema, process.env);

const app = await NestFactory.createApplicationContext(WorkerModule);

app.enableShutdownHooks();
