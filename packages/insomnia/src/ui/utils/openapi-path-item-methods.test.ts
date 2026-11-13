import { describe, expect, it } from 'vitest';

import { getMethodsFromOpenApiPathItem } from './openapi-path-item-methods';

const operation = { responses: {} };
const PETS = ['paths', '/pets'];

describe('getMethodsFromOpenApiPathItem', () => {
  it('returns standard methods in spec order, with the 3.2 query method last', () => {
    const result = getMethodsFromOpenApiPathItem(PETS, { query: operation, trace: operation, get: operation });

    expect(result).toEqual([
      { method: 'get', jumpTo: ['paths', '/pets', 'get'] },
      { method: 'trace', jumpTo: ['paths', '/pets', 'trace'] },
      { method: 'query', jumpTo: ['paths', '/pets', 'query'] },
    ]);
  });

  it('expands additionalOperations in declaration order instead of listing the key itself', () => {
    const result = getMethodsFromOpenApiPathItem(PETS, {
      get: operation,
      additionalOperations: { PURGE: operation, LINK: operation },
    });

    expect(result).toEqual([
      { method: 'get', jumpTo: ['paths', '/pets', 'get'] },
      { method: 'PURGE', jumpTo: ['paths', '/pets', 'additionalOperations', 'PURGE'] },
      { method: 'LINK', jumpTo: ['paths', '/pets', 'additionalOperations', 'LINK'] },
    ]);
  });

  it('keeps names containing dots as a single segment, e.g. webhooks', () => {
    const result = getMethodsFromOpenApiPathItem(['webhooks', 'pet.created'], { post: operation });

    expect(result).toEqual([{ method: 'post', jumpTo: ['webhooks', 'pet.created', 'post'] }]);
  });

  describe('Path Item $ref', () => {
    const pathItems = {
      Pets: { get: operation, query: operation, additionalOperations: { PURGE: operation } },
    };

    it('resolves a local components.pathItems reference and points at the referenced operations', () => {
      const result = getMethodsFromOpenApiPathItem(PETS, { $ref: '#/components/pathItems/Pets' }, pathItems);

      expect(result).toEqual([
        { method: 'get', jumpTo: ['components', 'pathItems', 'Pets', 'get'] },
        { method: 'query', jumpTo: ['components', 'pathItems', 'Pets', 'query'] },
        { method: 'PURGE', jumpTo: ['components', 'pathItems', 'Pets', 'additionalOperations', 'PURGE'] },
      ]);
    });

    it.each([
      ['percent-encoded', '#/components/pathItems/Pets%2Ev1', 'Pets.v1'],
      ['JSON Pointer escaped', '#/components/pathItems/Pets~1v1~0', 'Pets/v1~'],
    ])('decodes a %s component name', (_label, $ref, name) => {
      const result = getMethodsFromOpenApiPathItem(PETS, { $ref }, { [name]: { get: operation } });

      expect(result).toEqual([{ method: 'get', jumpTo: ['components', 'pathItems', name, 'get'] }]);
    });

    it('prefers the methods defined next to the $ref', () => {
      const result = getMethodsFromOpenApiPathItem(
        PETS,
        { $ref: '#/components/pathItems/Pets', post: operation },
        pathItems,
      );

      expect(result).toEqual([{ method: 'post', jumpTo: ['paths', '/pets', 'post'] }]);
    });

    it.each([
      ['an external file', './paths/pets.yaml'],
      ['a non pathItems pointer', '#/paths/~1other'],
      ['a missing target', '#/components/pathItems/Missing'],
      ['a malformed percent escape', '#/components/pathItems/Pets%E0%A4%A'],
    ])('returns nothing for %s', (_label, $ref) => {
      expect(getMethodsFromOpenApiPathItem(PETS, { $ref }, pathItems)).toEqual([]);
    });

    it('does not follow a reference chain', () => {
      const result = getMethodsFromOpenApiPathItem(
        PETS,
        { $ref: '#/components/pathItems/A' },
        {
          A: { $ref: '#/components/pathItems/B' },
          B: { get: operation },
        },
      );

      expect(result).toEqual([]);
    });
  });
});
