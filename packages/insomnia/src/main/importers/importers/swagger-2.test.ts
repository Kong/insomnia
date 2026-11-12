import { describe, expect, it } from 'vitest';

import type { ImportRequest } from '../entities';
import { convert } from './swagger-2';

describe('swagger-2', () => {
  describe('unresolved remote $ref', () => {
    it('should still import operations whose body schema is a blocked remote $ref', async () => {
      const swaggerDoc = {
        swagger: '2.0',
        info: { title: 'Remote body API', version: '1.0.0' },
        host: 'api.example.com',
        schemes: ['https'],
        consumes: ['application/json'],
        paths: {
          '/remote': {
            post: {
              parameters: [{ in: 'body', name: 'body', schema: { $ref: 'http://example.com/body.json' } }],
              responses: { 200: { description: 'ok' } },
            },
          },
          '/local': {
            get: { responses: { 200: { description: 'ok' } } },
          },
        },
      };

      const result = await convert(JSON.stringify(swaggerDoc));

      const requests = (result as ImportRequest[]).filter(item => item._type === 'request');
      expect(requests).toHaveLength(2);
      expect(requests.find(request => request.url?.endsWith('/remote'))?.body).toEqual({
        mimeType: 'application/json',
        text: '{}',
      });
    });
  });
});
