import { describe, expect, it } from 'vitest';

import { getMethodsFromOpenApiPathItem } from './openapi-path-item-methods';

const operation = { responses: {} };

describe('getMethodsFromOpenApiPathItem', () => {
  it('returns standard methods in spec order, with the 3.2 query method last', () => {
    const result = getMethodsFromOpenApiPathItem('/pets', { query: operation, trace: operation, get: operation });

    expect(result).toEqual([
      { method: 'get', jumpTo: 'paths./pets.get' },
      { method: 'trace', jumpTo: 'paths./pets.trace' },
      { method: 'query', jumpTo: 'paths./pets.query' },
    ]);
  });

  it('expands additionalOperations in declaration order instead of listing the key itself', () => {
    const result = getMethodsFromOpenApiPathItem('/pets', {
      get: operation,
      additionalOperations: { PURGE: operation, LINK: operation },
    });

    expect(result).toEqual([
      { method: 'get', jumpTo: 'paths./pets.get' },
      { method: 'PURGE', jumpTo: 'paths./pets.additionalOperations.PURGE' },
      { method: 'LINK', jumpTo: 'paths./pets.additionalOperations.LINK' },
    ]);
  });

  describe('Path Item $ref', () => {
    const pathItems = {
      Pets: { get: operation, query: operation, additionalOperations: { PURGE: operation } },
    };

    it('resolves a local components.pathItems reference and points at the referenced operations', () => {
      const result = getMethodsFromOpenApiPathItem('/pets', { $ref: '#/components/pathItems/Pets' }, pathItems);

      expect(result).toEqual([
        { method: 'get', jumpTo: 'components.pathItems.Pets.get' },
        { method: 'query', jumpTo: 'components.pathItems.Pets.query' },
        { method: 'PURGE', jumpTo: 'components.pathItems.Pets.additionalOperations.PURGE' },
      ]);
    });

    it('prefers the methods defined next to the $ref', () => {
      const result = getMethodsFromOpenApiPathItem(
        '/pets',
        { $ref: '#/components/pathItems/Pets', post: operation },
        pathItems,
      );

      expect(result).toEqual([{ method: 'post', jumpTo: 'paths./pets.post' }]);
    });

    it.each([
      ['an external file', './paths/pets.yaml'],
      ['a URL', 'https://example.com/pets.yaml'],
      ['a non pathItems pointer', '#/paths/~1other'],
      ['a missing target', '#/components/pathItems/Missing'],
    ])('returns nothing for %s', (_label, $ref) => {
      expect(getMethodsFromOpenApiPathItem('/pets', { $ref }, pathItems)).toEqual([]);
    });

    it('does not follow a reference chain', () => {
      const result = getMethodsFromOpenApiPathItem('/pets', { $ref: '#/components/pathItems/A' }, {
        A: { $ref: '#/components/pathItems/B' },
        B: { get: operation },
      });

      expect(result).toEqual([]);
    });
  });
});
