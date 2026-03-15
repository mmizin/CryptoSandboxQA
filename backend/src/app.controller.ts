import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      name: 'Test Exchange API',
      version: '1.0',
      docs: '/api/docs',
      docsJson: '/api/docs-json',
    };
  }
}
