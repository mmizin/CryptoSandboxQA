import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiJsonExample } from './openapi/api-json-example.decorator';
import * as OA from './openapi/response-examples';

@ApiTags('app')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API metadata and documentation links' })
  @ApiJsonExample(200, 'Service name, version, and doc URLs', OA.app.root)
  root() {
    return {
      name: 'Test Exchange API',
      version: '1.0',
      docs: '/api/docs',
      docsJson: '/api/docs-json',
    };
  }
}
