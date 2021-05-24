import { OpenApi3Spec } from '../types/openapi3';

/** This function is written in such a way as to allow mutations in tests but without affecting other tests. */
export const getSpec = (overrides: Partial<OpenApi3Spec> = {}): OpenApi3Spec =>
  JSON.parse(
    JSON.stringify({
      openapi: '3.0',
      info: {
        version: '1.0',
        title: 'My API',
      },
      servers: [
        {
          url: 'https://server1.com/path',
        },
      ],
      paths: {
        '/cats': {
          'x-kong-name': 'Cat stuff',
          summary: 'summary is ignored',
          post: {},
        },
        '/dogs': {
          summary: 'Dog stuff',
          get: {},
          post: {
            summary: 'Ignored summary',
          },
        },
        '/birds/{id}': {
          get: {},
        },
      },
      ...overrides,
    }),
  );
