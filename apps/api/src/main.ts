import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ApiEnvSchema, loadEnvFileIfPresent, validateEnv } from '@vynor/contracts';

import { AppModule } from './app.module.js';

// Load local .env if present
loadEnvFileIfPresent();

// FND-011 / FND-017: Validate environment variables on startup.
// Crashes immediately with descriptive diagnostics if configuration is invalid or missing.
const env = validateEnv(ApiEnvSchema, process.env);

const app = await NestFactory.create(AppModule);

app.enableShutdownHooks();

await app.listen(env.PORT);
