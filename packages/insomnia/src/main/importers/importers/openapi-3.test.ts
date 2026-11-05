// @ts-nocheck
import type { OpenAPIV3 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import { convert } from './openapi-3';

describe('openapi-3', () => {
  describe('query parameters', () => {
    it('should flatten object-type query parameters into bracket notation', async () => {
      const openApiDoc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: {
          title: 'Platform API',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'https://api.example.com/v3',
          },
        ],
        paths: {
          '/organizations/{organizationId}/users': {
            get: {
              operationId: 'listUsers',
              parameters: [
                {
                  name: 'organizationId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'filter',
                  in: 'query',
                  required: true,
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'object',
                        properties: {
                          contains: { type: 'string' },
                        },
                      },
                      email: {
                        type: 'object',
                        properties: {
                          contains: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              ],
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
          '/pets': {
            get: {
              operationId: 'listPets',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  schema: { type: 'integer' },
                },
                {
                  name: 'status',
                  in: 'query',
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      expect(result).not.toBeNull();

      const usersRequest = result?.find(item => item._type === 'request' && item.url?.includes('/users'));
      expect(usersRequest).toBeDefined();

      const params = usersRequest?.parameters || [];
      expect(params.length).toBe(2);

      const filterNameContainsParam = params.find(p => p.name === 'filter[name][contains]');
      expect(filterNameContainsParam).toBeDefined();
      expect(filterNameContainsParam?.value).toBe('string');
      expect(filterNameContainsParam?.disabled).toBe(false);

      const filterEmailContainsParam = params.find(p => p.name === 'filter[email][contains]');
      expect(filterEmailContainsParam).toBeDefined();
      expect(filterEmailContainsParam?.value).toBe('string');
      expect(filterEmailContainsParam?.disabled).toBe(false);

      const petsRequest = result?.find(item => item._type === 'request' && item.url?.includes('/pets'));
      expect(petsRequest).toBeDefined();

      const petsParams = petsRequest?.parameters || [];
      expect(petsParams.length).toBe(2);

      const limitParam = petsParams.find(p => p.name === 'limit');
      expect(limitParam).toBeDefined();
      expect(limitParam?.value).toBe('0');

      const statusParam = petsParams.find(p => p.name === 'status');
      expect(statusParam).toBeDefined();
      expect(statusParam?.value).toBe('string');

      const allValues = [...params, ...petsParams].map(p => p.value);
      expect(allValues).not.toContain('[object Object]');
    });

    it('should flatten deeply nested object-type query parameters', async () => {
      const openApiDoc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: {
          title: 'Nested API',
          version: '1.0.0',
        },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              parameters: [
                {
                  name: 'filter',
                  in: 'query',
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      sort: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          order: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      expect(result).not.toBeNull();

      const request = result?.find(item => item._type === 'request');
      expect(request).toBeDefined();

      const params = request?.parameters || [];
      expect(params.length).toBe(3);

      const statusParam = params.find(p => p.name === 'filter[status]');
      expect(statusParam).toBeDefined();
      expect(statusParam?.value).toBe('string');

      const sortFieldParam = params.find(p => p.name === 'filter[sort][field]');
      expect(sortFieldParam).toBeDefined();
      expect(sortFieldParam?.value).toBe('string');

      const sortOrderParam = params.find(p => p.name === 'filter[sort][order]');
      expect(sortOrderParam).toBeDefined();
      expect(sortOrderParam?.value).toBe('string');

      const allValues = params.map(p => p.value);
      expect(allValues).not.toContain('[object Object]');
    });
  });

  describe('schema composition with allOf, oneOf, and anyOf', () => {
    it('should handle schema composition with pet-related schemas', async () => {
      const openApiDoc: OpenAPIV3.Document = {
        openapi: '3.1.1',
        info: {
          title: 'Pet Store API',
          version: '2.0.0',
          contact: {
            email: 'info@petstore.com',
          },
        },
        servers: [
          {
            url: 'http://localhost/petstore/api/v1',
          },
        ],
        paths: {
          '/pets': {
            post: {
              operationId: 'createPet',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Pet',
                    },
                    example: {
                      name: 'Fluffy',
                      age: 3,
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Pet created',
                },
              },
            },
          },
          '/cats': {
            post: {
              operationId: 'createCat',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Cat',
                    },
                    example: {
                      hunts: true,
                      age: 5,
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Cat created',
                },
              },
            },
          },
          '/adopted-pets': {
            post: {
              operationId: 'createAdoptedPet',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/AdoptedPet',
                    },
                    example: {
                      name: 'Buddy',
                      age: 2,
                      adoptionDate: '2024-01-15',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Adopted pet created',
                },
              },
            },
          },
          '/pets/update': {
            patch: {
              operationId: 'updatePet',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/CatOrDog',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Pet updated',
                },
              },
            },
          },
          '/pets/any': {
            post: {
              operationId: 'createAnyPet',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/AnyPet',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Any pet created',
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Pet: {
              allOf: [{ $ref: '#/components/schemas/PetBase' }, { $ref: '#/components/schemas/PetDetails' }],
            },
            AdoptedPet: {
              allOf: [
                {
                  $ref: '#/components/schemas/Pet',
                },
                {
                  type: 'object',
                  properties: {
                    adoptionDate: {
                      type: 'string',
                      example: '2024-01-15',
                    },
                  },
                },
              ],
            },
            PetBase: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'Fluffy',
                },
              },
            },
            PetDetails: {
              type: 'object',
              properties: {
                age: {
                  type: 'integer',
                  example: 3,
                },
              },
            },
            Cat: {
              type: 'object',
              properties: {
                hunts: {
                  type: 'boolean',
                  example: true,
                },
                age: {
                  type: 'integer',
                  example: 5,
                },
              },
            },
            Dog: {
              type: 'object',
              properties: {
                bark: {
                  type: 'boolean',
                  example: true,
                },
                breed: {
                  type: 'string',
                  example: 'Husky',
                },
              },
            },
            CatOrDog: {
              oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }],
            },
            AnyPet: {
              anyOf: [{ $ref: '#/components/schemas/Dog' }, { $ref: '#/components/schemas/Cat' }],
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      expect(result).not.toBeNull();

      // Find the /pets request (allOf with Pet = PetBase + PetDetails)
      const petsRequest = result?.find(
        item =>
          item._type === 'request' &&
          item.url?.includes('/pets') &&
          !item.url?.includes('/update') &&
          !item.url?.includes('/any'),
      );
      expect(petsRequest).toBeDefined();
      expect(petsRequest?.method).toBe('POST');
      expect(petsRequest?.url).toContain('/pets');

      // Verify the /pets request body (allOf merges PetBase and PetDetails)
      expect(petsRequest?.body).toBeDefined();
      expect(petsRequest?.body?.mimeType).toBe('application/json');
      expect(petsRequest?.body?.text).toBeDefined();

      const petsBodyData = JSON.parse(petsRequest?.body?.text || '{}');
      expect(petsBodyData.name).toBe('Fluffy');
      expect(petsBodyData.age).toBe(3);

      // Verify Content-Type header
      const petsContentTypeHeader = petsRequest?.headers?.find(h => h.name === 'Content-Type');
      expect(petsContentTypeHeader).toBeDefined();
      expect(petsContentTypeHeader?.value).toBe('application/json');

      // Find the /cats request (Cat schema with hunts and age)
      const catsRequest = result?.find(item => item._type === 'request' && item.url?.includes('/cats'));
      expect(catsRequest).toBeDefined();
      expect(catsRequest?.method).toBe('POST');
      expect(catsRequest?.url).toContain('/cats');

      // Verify the /cats request body
      expect(catsRequest?.body).toBeDefined();
      expect(catsRequest?.body?.mimeType).toBe('application/json');
      expect(catsRequest?.body?.text).toBeDefined();

      const catsBodyData = JSON.parse(catsRequest?.body?.text || '{}');
      expect(catsBodyData.hunts).toBe(true);
      expect(catsBodyData.age).toBe(5);

      // Verify Content-Type header for /cats
      const catsContentTypeHeader = catsRequest?.headers?.find(h => h.name === 'Content-Type');
      expect(catsContentTypeHeader).toBeDefined();
      expect(catsContentTypeHeader?.value).toBe('application/json');

      // Find the /adopted-pets request (nested allOf: Pet + adoptionDate)
      const adoptedPetsRequest = result?.find(item => item._type === 'request' && item.url?.includes('/adopted-pets'));
      expect(adoptedPetsRequest).toBeDefined();
      expect(adoptedPetsRequest?.method).toBe('POST');
      expect(adoptedPetsRequest?.url).toContain('/adopted-pets');

      // Verify the /adopted-pets request body with nested allOf
      expect(adoptedPetsRequest?.body).toBeDefined();
      expect(adoptedPetsRequest?.body?.mimeType).toBe('application/json');
      expect(adoptedPetsRequest?.body?.text).toBeDefined();

      const adoptedPetsBodyData = JSON.parse(adoptedPetsRequest?.body?.text || '{}');
      expect(adoptedPetsBodyData.name).toBe('Fluffy');
      expect(adoptedPetsBodyData.age).toBe(3);
      expect(adoptedPetsBodyData.adoptionDate).toBe('2024-01-15');

      // Verify Content-Type header for /adopted-pets
      const adoptedPetsContentTypeHeader = adoptedPetsRequest?.headers?.find(h => h.name === 'Content-Type');
      expect(adoptedPetsContentTypeHeader).toBeDefined();
      expect(adoptedPetsContentTypeHeader?.value).toBe('application/json');

      // Find the /pets/update request (oneOf - uses first schema: Cat)
      const updatePetRequest = result?.find(item => item._type === 'request' && item.url?.includes('/pets/update'));
      expect(updatePetRequest).toBeDefined();
      expect(updatePetRequest?.method).toBe('PATCH');
      expect(updatePetRequest?.url).toContain('/pets/update');

      // Verify the /pets/update request body with oneOf (should use first schema: Cat)
      expect(updatePetRequest?.body).toBeDefined();
      expect(updatePetRequest?.body?.mimeType).toBe('application/json');
      expect(updatePetRequest?.body?.text).toBeDefined();

      const updatePetBodyData = JSON.parse(updatePetRequest?.body?.text || '{}');
      expect(updatePetBodyData.hunts).toBe(true);
      expect(updatePetBodyData.age).toBe(5);
      expect(updatePetBodyData.bark).toBeUndefined();
      expect(updatePetBodyData.breed).toBeUndefined();

      // Verify Content-Type header for /pets/update
      const updatePetContentTypeHeader = updatePetRequest?.headers?.find(h => h.name === 'Content-Type');
      expect(updatePetContentTypeHeader).toBeDefined();
      expect(updatePetContentTypeHeader?.value).toBe('application/json');

      // Find the /pets/any request (anyOf - uses first schema: Dog)
      const anyPetRequest = result?.find(item => item._type === 'request' && item.url?.includes('/pets/any'));
      expect(anyPetRequest).toBeDefined();
      expect(anyPetRequest?.method).toBe('POST');
      expect(anyPetRequest?.url).toContain('/pets/any');

      // Verify the /pets/any request body with anyOf (should use first schema: Dog)
      expect(anyPetRequest?.body).toBeDefined();
      expect(anyPetRequest?.body?.mimeType).toBe('application/json');
      expect(anyPetRequest?.body?.text).toBeDefined();

      const anyPetBodyData = JSON.parse(anyPetRequest?.body?.text || '{}');
      expect(anyPetBodyData.bark).toBe(true);
      expect(anyPetBodyData.breed).toBe('Husky');
      expect(anyPetBodyData.hunts).toBeUndefined();

      // Verify Content-Type header for /pets/any
      const anyPetContentTypeHeader = anyPetRequest?.headers?.find(h => h.name === 'Content-Type');
      expect(anyPetContentTypeHeader).toBeDefined();
      expect(anyPetContentTypeHeader?.value).toBe('application/json');
    });
  });

  describe('circular $ref', () => {
    it('should import a schema that references itself without recursing forever', async () => {
      const openApiDoc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Tree API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/nodes': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Node' },
                  },
                },
              },
              responses: { 200: { description: 'ok' } },
            },
          },
        },
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                parent: { $ref: '#/components/schemas/Node' },
                children: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
              },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      expect(result).not.toBeNull();
      const request = result?.find(item => item._type === 'request');

      const body = JSON.parse(request.body.text);
      expect(body.name).toBe('string');
      expect(Array.isArray(body.children)).toBe(true);
      // the cycle is cut off with null instead of expanding forever
      let node = body;
      let depth = 0;
      while (node && depth < 10) {
        node = node.parent;
        depth++;
      }
      expect(node).toBeNull();
      expect(depth).toBeLessThan(10);
    });
  });
  describe('OpenAPI 3.2', () => {
    it('should import additionalOperations as one request per custom method', async () => {
      const openApiDoc = {
        openapi: '3.2.0',
        info: { title: 'Cache API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets': {
            get: { operationId: 'listPets', responses: { 200: { description: 'ok' } } },
            query: { operationId: 'queryPets', responses: { 200: { description: 'ok' } } },
            additionalOperations: {
              PURGE: { operationId: 'purgePets', responses: { 204: { description: 'purged' } } },
              LINK: { operationId: 'linkPets', responses: { 204: { description: 'linked' } } },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      const requests = result?.filter(item => item._type === 'request');

      expect(requests.map(r => r.method)).toEqual(['GET', 'QUERY', 'PURGE', 'LINK']);
      expect(requests.every(r => r.url === '{{ _.base_url }}/pets')).toBe(true);
    });

    it('should expand an in: querystring parameter into one query parameter per property', async () => {
      const openApiDoc = {
        openapi: '3.2.0',
        info: { title: 'Pets', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets/lookup': {
            get: {
              parameters: [
                {
                  name: 'filter',
                  in: 'querystring',
                  required: true,
                  content: {
                    'application/x-www-form-urlencoded': {
                      schema: {
                        type: 'object',
                        required: ['name'],
                        properties: { name: { type: 'string' }, limit: { type: 'integer', default: 10 } },
                      },
                    },
                  },
                },
              ],
              responses: { 200: { description: 'ok' } },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      const request = result!.find(item => item._type === 'request');

      expect(request.parameters).toEqual([
        { name: 'name', value: 'string', disabled: false },
        { name: 'limit', value: '10', disabled: true },
      ]);
    });

    it('should disable all querystring properties when the parameter is optional, and skip non form-urlencoded content', async () => {
      const openApiDoc = {
        openapi: '3.2.0',
        info: { title: 'Pets', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets': {
            get: {
              parameters: [
                {
                  name: 'optional',
                  in: 'querystring',
                  content: {
                    'application/x-www-form-urlencoded': {
                      schema: { type: 'object', required: ['a'], properties: { a: { type: 'string' } } },
                    },
                  },
                },
              ],
              responses: { 200: { description: 'ok' } },
            },
            post: {
              parameters: [
                {
                  name: 'json',
                  in: 'querystring',
                  required: true,
                  content: { 'application/json': { schema: { type: 'object' } } },
                },
              ],
              responses: { 200: { description: 'ok' } },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      const [get, post] = result!.filter(item => item._type === 'request');

      expect(get.parameters).toEqual([{ name: 'a', value: 'string', disabled: true }]);
      expect(post.parameters).toEqual([]);
    });
  });

  describe('path level parameters', () => {
    it('should merge Path Item parameters into each operation, letting the operation override', async () => {
      const openApiDoc = {
        openapi: '3.0.3',
        info: { title: 'Pets', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets': {
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
              { name: 'sort', in: 'query', schema: { type: 'string', default: 'asc' } },
              { name: 'X-Trace', in: 'header', required: true, schema: { type: 'string' } },
            ],
            get: {
              parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer', default: 50 } }],
              responses: { 200: { description: 'ok' } },
            },
            post: { responses: { 200: { description: 'ok' } } },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      const [get, post] = result!.filter(item => item._type === 'request');

      expect(get.parameters).toEqual([
        { name: 'sort', value: 'asc', disabled: true },
        { name: 'limit', value: '50', disabled: false },
      ]);
      expect(get.headers).toContainEqual({ name: 'X-Trace', value: 'string', disabled: false });
      expect(post.parameters).toEqual([
        { name: 'limit', value: '10', disabled: true },
        { name: 'sort', value: 'asc', disabled: true },
      ]);
    });
  });

  describe('text/event-stream responses', () => {
    const buildDoc = (responses: Record<string, unknown>, parameters: unknown[] = []) => ({
      openapi: '3.1.0',
      info: { title: 'Events', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      paths: { '/events': { get: { parameters, responses } } },
    });

    it('should add an Accept header for a 2xx text/event-stream response', async () => {
      const doc = buildDoc({ 200: { description: 'ok', content: { 'text/event-stream; charset=utf-8': {} } } });
      const request = (await convert(JSON.stringify(doc)))!.find(item => item._type === 'request');

      expect(request.headers).toEqual([{ name: 'Accept', value: 'text/event-stream', disabled: false }]);
    });

    it('should accept 2XX range keys', async () => {
      const doc = buildDoc({ '2XX': { description: 'ok', content: { 'text/event-stream': {} } } });
      const request = (await convert(JSON.stringify(doc)))!.find(item => item._type === 'request');

      expect(request.headers.map(h => h.name)).toEqual(['Accept']);
    });

    it('should not add Accept for non-2xx, other streaming types or an explicit Accept parameter', async () => {
      const nonSuccess = buildDoc({ 400: { description: 'bad', content: { 'text/event-stream': {} } } });
      const ndjson = buildDoc({ 200: { description: 'ok', content: { 'application/x-ndjson': {} } } });
      const explicit = buildDoc({ 200: { description: 'ok', content: { 'text/event-stream': {} } } }, [
        { name: 'Accept', in: 'header', schema: { type: 'string', default: 'application/json' } },
      ]);

      for (const doc of [nonSuccess, ndjson]) {
        const request = (await convert(JSON.stringify(doc)))!.find(item => item._type === 'request');
        expect(request.headers).toEqual([]);
      }
      const request = (await convert(JSON.stringify(explicit)))!.find(item => item._type === 'request');
      expect(request.headers).toEqual([{ name: 'Accept', value: 'application/json', disabled: true }]);
    });
  });

  describe('webhooks', () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'Pets', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      tags: [{ name: 'pets' }],
      paths: { '/pets': { get: { tags: ['pets'], responses: { 200: { description: 'ok' } } } } },
      webhooks: {
        petAdopted: {
          post: {
            tags: ['pets'],
            summary: 'Fired when a pet is adopted',
            requestBody: {
              content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
            },
            responses: { 200: { description: 'ok' } },
          },
        },
        petRemoved: { delete: { responses: { 200: { description: 'ok' } } } },
      },
    };

    it('should import webhook operations into a Webhooks folder, outside tag folders, using {{ _.webhook_url }}', async () => {
      const result = await convert(JSON.stringify(doc));
      const folder = result?.find(item => item._type === 'request_group' && item.name === 'Webhooks');
      const webhooks = result?.filter(item => item._type === 'request' && item.parentId === folder?._id);
      const petsFolder = result?.find(item => item._type === 'request_group' && item.name === 'pets');
      const inPetsFolder = result?.filter(item => item._type === 'request' && item.parentId === petsFolder?._id);
      const baseEnv = result?.find(item => item._type === 'environment');

      expect(folder).toBeDefined();
      expect(webhooks.map(r => [r.name, r.method, r.url])).toEqual([
        ['Fired when a pet is adopted', 'POST', '{{ _.webhook_url }}'],
        ['petRemoved', 'DELETE', '{{ _.webhook_url }}'],
      ]);
      expect(webhooks[0].body.mimeType).toBe('application/json');
      expect(webhooks[0].body.text).toContain('"name"');
      expect(inPetsFolder.map(r => r.method)).toEqual(['GET']);
      expect(baseEnv.data.webhook_url).toBe('https://example.com/webhook');
    });
  });

  describe('OpenAPI 3.1 schema keywords', () => {
    it('should use examples, const and the first non-null type for example values', async () => {
      const openApiDoc = {
        openapi: '3.1.0',
        info: { title: 'Pets', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/pets': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: ['string', 'null'] },
                        kind: { const: 'dog' },
                        zero: { const: 0 },
                        flag: { const: false },
                        tag: { type: 'string', examples: ['rex', 'fido'] },
                      },
                    },
                  },
                },
              },
              responses: { 200: { description: 'ok' } },
            },
          },
        },
      };

      const result = await convert(JSON.stringify(openApiDoc));
      const request = result?.find(item => item._type === 'request');

      expect(JSON.parse(request.body.text)).toEqual({
        name: 'string',
        kind: 'dog',
        zero: 0,
        flag: false,
        tag: 'rex',
      });
    });
  });
});
