/**
 * @vitest-environment jsdom
 */
import type { Request } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { buildMimeTypePatch } from './content-type-dropdown';

const requestWithBody = (body: Request['body']): Request =>
  ({
    _id: 'req_1',
    type: 'Request',
    parentId: 'wrk_1',
    name: '',
    url: '',
    method: 'POST',
    parameters: [],
    headers: [{ name: 'Content-Type', value: 'application/json' }],
    body,
    authentication: {},
    pathParameters: [],
  }) as unknown as Request;

describe('buildMimeTypePatch', () => {
  it('builds a complete body for an example snapshot, so switching type keeps the text', () => {
    const request = requestWithBody({ mimeType: 'application/json', text: '{"a":1}' });

    const patch = buildMimeTypePatch(request, 'application/xml', true);

    expect(patch.body).toEqual({ mimeType: 'application/xml', text: '{"a":1}' });
    expect(patch.headers).toEqual([{ name: 'Content-Type', value: 'application/xml' }]);
  });

  it('sends only the mime type for the request route, which expands it in its action', () => {
    const request = requestWithBody({ mimeType: 'application/json', text: '{"a":1}' });

    expect(buildMimeTypePatch(request, 'application/xml', false)).toEqual({ body: { mimeType: 'application/xml' } });
  });
});
