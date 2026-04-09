import { ApiResponse } from '@nestjs/swagger';

type JsonExampleEntry = {
  summary?: string;
  description?: string;
  value: unknown;
};

/** JSON body with a single `example` (shown in Swagger UI for that response). */
export function ApiJsonExample(status: number, description: string, example: unknown) {
  return ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        schema: {
          example,
        },
      },
    },
  });
}

/** JSON body with multiple named examples (e.g. alternate success shapes). */
export function ApiJsonExamples(
  status: number,
  description: string,
  examples: Record<string, JsonExampleEntry>,
) {
  const mapped: Record<string, { summary?: string; description?: string; value: unknown }> = {};
  for (const [key, v] of Object.entries(examples)) {
    mapped[key] = {
      summary: v.summary,
      description: v.description,
      value: v.value,
    };
  }
  return ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        examples: mapped,
      },
    },
  });
}

/** Non-JSON success body (e.g. Prometheus text exposition). */
export function ApiPlainTextExample(status: number, description: string, example: string) {
  return ApiResponse({
    status,
    description,
    content: {
      'text/plain': {
        schema: {
          type: 'string',
          example,
        },
      },
    },
  });
}
