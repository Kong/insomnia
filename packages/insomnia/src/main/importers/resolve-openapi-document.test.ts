import dns from 'node:dns/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveOpenApiDocument } from './resolve-openapi-document';

vi.mock('node:dns/promises', () => ({ default: { lookup: vi.fn() } }));

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
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as any);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(REMOTE_ERROR)));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('resolves local and public https remote references', async () => {
    const result = await resolveOpenApiDocument(buildDoc('https://example.com/error.json'), '[test]');

    expect(getSchemas(result)).toEqual({ body: PET, error: REMOTE_ERROR });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/error.json',
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it.each([
    ['http URLs', 'http://example.com/error.json', undefined],
    ['private hosts', 'https://192.168.0.1/error.json', undefined],
    ['hosts resolving to a private address', 'https://internal.example.com/error.json', '127.0.0.1'],
  ])('does not fetch %s but still resolves local references', async (_label, remoteRef, resolvedAddress) => {
    if (resolvedAddress) {
      vi.mocked(dns.lookup).mockResolvedValue([{ address: resolvedAddress, family: 4 }] as any);
    }

    const result = await resolveOpenApiDocument(buildDoc(remoteRef), '[test]');

    expect(fetchMock).not.toHaveBeenCalled();
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
