import { describe, expect, it } from 'vitest';

import { getRequestBodyForMimeTypeChange } from './request-body-for-mime-type';

const buildRequestShape = (overrides: { headers?: any[]; body?: any } = {}) => ({
  headers: overrides.headers ?? [{ name: 'Content-Type', value: 'text/plain' }],
  body: overrides.body ?? { mimeType: 'text/plain', text: 'hello' },
});

describe('getRequestBodyForMimeTypeChange', () => {
  it('clears the body and Content-Type header for "No body"', () => {
    const result = getRequestBodyForMimeTypeChange(buildRequestShape(), null);

    expect(result).toEqual({ body: {}, headers: [] });
  });

  it('wraps the existing text as a GraphQL query and sets method to POST', () => {
    const result = getRequestBodyForMimeTypeChange(
      buildRequestShape({ body: { text: '{"query":"{ hello }"}' } }),
      'application/graphql',
    );

    expect(result.body).toEqual({ mimeType: 'application/graphql', text: '{"query":"{ hello }"}' });
    expect(result.method).toBe('POST');
    expect(result.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
  });

  it('falls back to raw text for GraphQL when the existing body is not valid JSON', () => {
    const result = getRequestBodyForMimeTypeChange(buildRequestShape({ body: { text: 'not json' } }), 'application/graphql');

    expect(result.body).toEqual({ mimeType: 'application/graphql', text: 'not json' });
  });

  it('deconstructs raw text into form params for a form-urlencoded mimeType', () => {
    const result = getRequestBodyForMimeTypeChange(
      buildRequestShape({ body: { text: 'a=1&b=2' } }),
      'application/x-www-form-urlencoded',
    );

    expect(result.body).toEqual({
      mimeType: 'application/x-www-form-urlencoded',
      params: [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ],
    });
  });

  it('reuses existing body.params for a form-data mimeType instead of re-parsing text', () => {
    const existingParams = [{ name: 'existing', value: 'param' }];
    const result = getRequestBodyForMimeTypeChange(
      buildRequestShape({ body: { text: 'ignored=1', params: existingParams } }),
      'multipart/form-data',
    );

    expect(result.body).toEqual({ mimeType: 'multipart/form-data', params: existingParams });
  });

  it('sets an empty fileName for a file mimeType', () => {
    const result = getRequestBodyForMimeTypeChange(buildRequestShape(), 'application/octet-stream');

    expect(result.body).toEqual({ mimeType: 'application/octet-stream', fileName: '' });
  });

  it('keeps the raw text and strips mimeType parameters for any other mimeType', () => {
    const result = getRequestBodyForMimeTypeChange(
      buildRequestShape({ body: { text: 'plain text' } }),
      'text/plain; charset=utf-8',
    );

    expect(result.body).toEqual({ mimeType: 'text/plain', text: 'plain text' });
  });

  it('drops any existing Content-Type header before setting the new one', () => {
    const result = getRequestBodyForMimeTypeChange(
      buildRequestShape({ headers: [{ name: 'content-type', value: 'text/plain' }, { name: 'X-Other', value: '1' }] }),
      'application/octet-stream',
    );

    expect(result.headers).toEqual([
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'X-Other', value: '1' },
    ]);
  });
});
