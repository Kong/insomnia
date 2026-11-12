import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicHttps } from '../safe-fetch';
import { resolveOpenApiDocument } from './resolve-openapi-document';

vi.mock('../safe-fetch', () => ({ fetchPublicHttps: vi.fn() }));

const REMOTE_ERROR = { type: 'object', properties: { code: { type: 'integer' } } };
const PET = { type: 'object', properties: { name: { type: 'string' } } };

const buildDoc = (remoteRef: string) => ({
  openapi: '3.0.3',
  info: { title: 'Pets', version: '1.0.0' },
  paths: {
    '/pets': {
      post: {
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
        responses: { 400: { description: 'error', content: { 'application/json': { schema: { $ref: remoteRef } } } } },
      },
    },
  },
  components: { schemas: { Pet: PET } },
});

const getSchemas = (document: any) => {
  const operation = document.paths['/pets'].post;
  return {
    body: operation.requestBody.content['application/json'].schema,
    error: operation.responses[400].content['application/json'].schema,
  };
};

describe('resolveOpenApiDocument', () => {
  const fetchMock = vi.mocked(fetchPublicHttps);

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(REMOTE_ERROR)) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('resolves local and remote references', async () => {
    const result = await resolveOpenApiDocument(buildDoc('https://example.com/error.json'), '[test]');

    expect(getSchemas(result)).toEqual({ body: PET, error: REMOTE_ERROR });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/error.json');
    expect(result).not.toHaveProperty('x-ext');
  });

  it('leaves a remote reference unresolved when it is refused by the fetch policy, but still resolves local references', async () => {
    fetchMock.mockRejectedValue(new Error('Only https URLs to public hosts are allowed.'));
    const remoteRef = 'http://example.com/error.json';

    const result = await resolveOpenApiDocument(buildDoc(remoteRef), '[test]');

    expect(getSchemas(result)).toEqual({ body: PET, error: { $ref: remoteRef } });
  });

  it('leaves a remote reference unresolved when the response is not ok', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }) as any);
    const remoteRef = 'https://example.com/missing.json';

    const result = await resolveOpenApiDocument(buildDoc(remoteRef), '[test]');

    expect(getSchemas(result)).toEqual({ body: PET, error: { $ref: remoteRef } });
  });

  it('still resolves references when the document fails validation', async () => {
    const doc = buildDoc('https://example.com/error.json');
    // `responses` is required on an operation in OpenAPI 3.0
    const invalidDoc = { ...doc, paths: { '/pets': { post: { requestBody: doc.paths['/pets'].post.requestBody } } } };

    const result = await resolveOpenApiDocument(invalidDoc, '[test]');

    expect(result.paths['/pets'].post.requestBody.content['application/json'].schema).toEqual(PET);
  });
});
