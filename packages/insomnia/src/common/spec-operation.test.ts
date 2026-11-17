import { describe, expect, it } from 'vitest';

import { findSpecOperationForRequest } from './spec-operation';

const spec = `
openapi: 3.0.0
paths:
  /pets:
    get: {}
    post: {}
  /pets/{petId}:
    get: {}
    delete: {}
  /v1.0/owners:
    get: {}
  /:
    get: {}
`;

describe('findSpecOperationForRequest', () => {
  it('matches a generated request url', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/pets' })).toEqual({
      path: '/pets',
      method: 'get',
    });
  });

  it('matches the OpenAPI 3 importer form, path parameters as :param', () => {
    expect(findSpecOperationForRequest(spec, { method: 'DELETE', url: '{{ _.base_url }}/pets/:petId' })).toEqual({
      path: '/pets/{petId}',
      method: 'delete',
    });
  });

  it('matches the Swagger 2 importer form, path parameters as {{ _.param }}', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/pets/{{ _.petId }}' })).toEqual({
      path: '/pets/{petId}',
      method: 'get',
    });
  });

  it('ignores query strings and hashes', () => {
    expect(findSpecOperationForRequest(spec, { method: 'POST', url: '{{ _.base_url }}/pets?limit=1' })).toEqual({
      path: '/pets',
      method: 'post',
    });
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/pets#top' })).toEqual({
      path: '/pets',
      method: 'get',
    });
  });

  it('handles paths containing dots', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/v1.0/owners' })).toEqual({
      path: '/v1.0/owners',
      method: 'get',
    });
  });

  it('returns null when the method is not defined for the path', () => {
    expect(findSpecOperationForRequest(spec, { method: 'POST', url: '{{ _.base_url }}/pets/:petId' })).toBeNull();
  });

  it('returns null when the url no longer matches what the importers generate', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/pets/42' })).toBeNull();
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/v1/pets' })).toBeNull();
  });

  it('returns null when the url does not start with the importers base url', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: 'https://api.example.com/pets' })).toBeNull();
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.host }}/pets' })).toBeNull();
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '/pets' })).toBeNull();
  });

  it('returns null for unknown paths, empty or invalid specs', () => {
    expect(findSpecOperationForRequest(spec, { method: 'GET', url: '{{ _.base_url }}/unknown' })).toBeNull();
    expect(findSpecOperationForRequest('', { method: 'GET', url: '/pets' })).toBeNull();
    expect(findSpecOperationForRequest('{{{ not yaml', { method: 'GET', url: '/pets' })).toBeNull();
  });
});
