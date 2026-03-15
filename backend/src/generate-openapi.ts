import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { createOpenApiConfig } from './openapi.config';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = createOpenApiConfig();
  const document = SwaggerModule.createDocument(app, config);

  const outputDir = join(__dirname, '../../docs');
  const outputPath = join(outputDir, 'openapi.json');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI spec written to docs/openapi.json`);
  await app.close();
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
