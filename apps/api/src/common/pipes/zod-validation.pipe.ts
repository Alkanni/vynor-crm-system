import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

/**
 * Zod validation pipe for NestJS (FND-BE-001, FND-039).
 * Can be registered globally or on specific route handlers with an explicit schema.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (this.schema) {
      return this.schema.parse(value);
    }

    const metatype = metadata.metatype as unknown as { schema?: ZodType } | undefined;
    if (metatype?.schema) {
      return metatype.schema.parse(value);
    }

    return value;
  }
}
