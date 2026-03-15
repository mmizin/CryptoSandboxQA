import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Shared Swagger/OpenAPI configuration.
 * Used by both the running server (main.ts) and the file generator (generate-openapi.ts).
 */
export function createOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('Test Exchange API')
    .setDescription('Crypto exchange training platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
