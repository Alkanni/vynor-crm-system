import { Controller, Get } from '@nestjs/common';
import { createSuccessEnvelope, type ApiSuccessResponse } from '@vynor/contracts';
import { Public } from '../iam/decorators.js';
import { ERROR_CATALOG, type ErrorCatalogEntry } from './error-catalog.js';
import { buildOpenApiDocument } from './openapi.document.js';

@Controller()
export class OpenApiController {
  /**
   * OpenAPI 3.1.0 document (FND-BE-010, FND-039).
   */
  @Public()
  @Get('openapi.json')
  getOpenApi(): Record<string, unknown> {
    return buildOpenApiDocument();
  }

  /**
   * Canonical machine-readable error catalog (FND-BE-010, FND-037).
   */
  @Public()
  @Get('error-catalog')
  getErrorCatalog(): ApiSuccessResponse<readonly ErrorCatalogEntry[]> {
    return createSuccessEnvelope(ERROR_CATALOG);
  }
}
