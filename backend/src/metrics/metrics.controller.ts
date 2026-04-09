import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { register } from 'prom-client';
import { ApiPlainTextExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';

@ApiTags('metrics')
@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics (text exposition format)' })
  @ApiPlainTextExample(200, 'Prometheus text format', OA.metrics.sample)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
