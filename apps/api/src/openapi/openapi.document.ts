/**
 * Generates the complete OpenAPI 3.1.0 document for VYNOR API (FND-BE-010, FND-039).
 */
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'VYNOR CRM API',
      version: '1.0.0',
      description:
        'Core REST API and Event Contracts for VYNOR Omnichannel CRM with Supabase Auth, RBAC, S3 Storage, and Realtime delivery.',
      contact: {
        name: 'VYNOR CRM Engineering',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'V1 API Root',
      },
    ],
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      '/health/live': {
        get: {
          summary: 'Liveness Probe',
          description: 'Fast event loop health check for container orchestration.',
          operationId: 'getLiveness',
          security: [],
          responses: {
            '200': {
              description: 'Service is alive',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LivenessReport' },
                },
              },
            },
          },
        },
      },
      '/health/ready': {
        get: {
          summary: 'Readiness Probe',
          description: 'Validates database and dependent infrastructure connectivity.',
          operationId: 'getReadiness',
          security: [],
          responses: {
            '200': {
              description: 'Service is ready to handle traffic',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadinessReport' },
                },
              },
            },
            '503': {
              description: 'Service is not ready (database unreachable)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReadinessReport' },
                },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          summary: 'Overall System Health',
          description: 'Aggregated health report across database, outbox, and queues.',
          operationId: 'getSystemHealth',
          security: [],
          responses: {
            '200': {
              description: 'Aggregated system health report',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/SystemHealthReport' },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/health/indicators': {
        get: {
          summary: 'Subsystem Health Indicators',
          description: 'Detailed indicators including outbox lag and database latency.',
          operationId: 'getHealthIndicators',
          security: [],
          responses: {
            '200': {
              description: 'Subsystem indicators breakdown',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiSuccessResponse' },
                },
              },
            },
          },
        },
      },
      '/attachments/{id}/download-url': {
        get: {
          summary: 'Generate Signed Download URL',
          description:
            'Generates a short-lived presigned GET URL for an attachment in the active workspace. Enforces malware scanning state and permissions.',
          operationId: 'getSignedDownloadUrl',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Opaque attachment identifier',
            },
            {
              name: 'ttl',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 10, maximum: 300, default: 60 },
              description: 'Desired URL expiration in seconds (10 to 300)',
            },
            {
              name: 'x-workspace-id',
              in: 'header',
              required: true,
              schema: { type: 'string' },
              description: 'Target workspace identifier',
            },
          ],
          responses: {
            '200': {
              description: 'Authorized signed download URL generated successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/SignedDownloadResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '401': {
              description: 'Authentication token missing or invalid',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Permission denied or workspace access rejected',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                },
              },
            },
            '404': {
              description: 'Attachment not found in this workspace',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                },
              },
            },
            '410': {
              description: 'Attachment has expired or was deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                },
              },
            },
            '422': {
              description: 'Attachment is infected or quarantined',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/openapi.json': {
        get: {
          summary: 'OpenAPI Specification',
          description: 'Returns the OpenAPI 3.1.0 document in JSON format.',
          operationId: 'getOpenApiSpec',
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI 3.1.0 specification document',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
      '/error-catalog': {
        get: {
          summary: 'Canonical Error Catalog',
          description: 'Returns the list of all standard error codes and descriptions.',
          operationId: 'getErrorCatalog',
          security: [],
          responses: {
            '200': {
              description: 'Canonical list of error codes',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ErrorCatalogEntry' },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token passed as Bearer <token>',
        },
      },
      schemas: {
        ApiSuccessResponse: {
          type: 'object',
          required: ['success', 'data', 'timestamp'],
          properties: {
            success: { type: 'boolean', const: true },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ApiErrorResponse: {
          type: 'object',
          required: ['statusCode', 'code', 'message', 'correlationId', 'timestamp'],
          properties: {
            statusCode: { type: 'integer' },
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
            correlationId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SignedDownloadResponse: {
          type: 'object',
          required: [
            'attachmentId',
            'filename',
            'mimeType',
            'sizeBytes',
            'downloadUrl',
            'expiresAt',
            'expiresInSeconds',
          ],
          properties: {
            attachmentId: { type: 'string' },
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            sizeBytes: { type: 'integer' },
            downloadUrl: { type: 'string', format: 'uri' },
            expiresAt: { type: 'string', format: 'date-time' },
            expiresInSeconds: { type: 'integer' },
          },
        },
        LivenessReport: {
          type: 'object',
          required: ['status', 'service', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['UP', 'DOWN'] },
            service: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ReadinessReport: {
          type: 'object',
          required: ['status', 'service', 'timestamp', 'dependencies'],
          properties: {
            status: { type: 'string', enum: ['UP', 'DOWN'] },
            service: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            dependencies: { type: 'object' },
          },
        },
        SystemHealthReport: {
          type: 'object',
          required: ['status', 'service', 'environment', 'version', 'timestamp', 'indicators'],
          properties: {
            status: { type: 'string', enum: ['UP', 'DEGRADED', 'DOWN'] },
            service: { type: 'string' },
            environment: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            indicators: { type: 'object' },
          },
        },
        ErrorCatalogEntry: {
          type: 'object',
          required: [
            'code',
            'httpStatus',
            'category',
            'description',
            'safeClientMessage',
            'actionableGuidance',
          ],
          properties: {
            code: { type: 'string' },
            httpStatus: { type: 'integer' },
            category: {
              type: 'string',
              enum: ['AUTH', 'IAM', 'VALIDATION', 'STORAGE', 'CONCURRENCY', 'SYSTEM'],
            },
            description: { type: 'string' },
            safeClientMessage: { type: 'string' },
            actionableGuidance: { type: 'string' },
          },
        },
      },
    },
  };
}
