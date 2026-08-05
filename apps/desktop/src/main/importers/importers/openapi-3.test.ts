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
});
