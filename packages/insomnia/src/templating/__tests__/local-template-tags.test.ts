import { describe, expect, it, vi } from 'vitest';

import { invariant } from '../../utils/invariant';
import { localTemplateTags } from '../local-template-tags';
import { type PluginTemplateTagContext } from '../types';

// Minimal mock context for the response tag
function makeResponseContext(bodyJson: string): PluginTemplateTagContext {
  const bodyBuffer = Buffer.from(bodyJson, 'utf8');
  return {
    context: {
      getMeta: () => ({}),
      getKeysContext: () => ({ keyContext: {} }),
      getPurpose: () => {},
      getExtraInfo: () => {},
      getEnvironmentId: () => {},
      getGlobalEnvironmentId: () => {},
      getProjectId: () => {},
      value: '',
    },
    meta: {},
    renderPurpose: 'general',
    util: {
      decode: vi.fn(async (buf: Buffer) => buf.toString('utf8')),
      models: {
        request: {
          getById: vi.fn(async () => ({ _id: 'req_1' })),
        },
        response: {
          getLatestForRequestId: vi.fn(async () => ({
            _id: 'res_1',
            statusCode: 200,
            contentType: 'application/json; charset=utf-8',
            headers: [],
            url: 'http://example.com',
            error: '',
            environmentId: undefined,
            globalEnvironmentId: undefined,
          })),
          getBodyBuffer: vi.fn(async () => bodyBuffer),
        },
      },
    },
  } as unknown as PluginTemplateTagContext;
}

describe('response tag', () => {
  const responseTag = localTemplateTags.find(p => p.templateTag.name === 'response')?.templateTag;
  invariant(responseTag, 'missing response tag in localTemplateTags');

  describe('JSONPath body attribute - large integer precision', () => {
    it('returns a large integer (19 digits) with exact precision', async () => {
      const ctx = makeResponseContext('{"id": 1234567890123456789}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.id', 'never', 60);
      expect(result).toBe('1234567890123456789');
    });

    it('returns a large integer (20 digits) with exact precision', async () => {
      // Make sure this number doesn't end with a 0, otherwise rounding errors may be masked
      const ctx = makeResponseContext('{"id": 12345678901234567892}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.id', 'never', 60);
      expect(result).toBe('12345678901234567892');
    });

    it('does not round large integers near Number.MAX_SAFE_INTEGER boundary', async () => {
      // JSON.parse would silently corrupt this: 9007199254740993 → 9007199254740992
      const ctx = makeResponseContext('{"val": 9007199254740993}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.val', 'never', 60);
      expect(result).toBe('9007199254740993');
    });

    it('handles regular integers without regression', async () => {
      const ctx = makeResponseContext('{"count": 42}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.count', 'never', 60);
      expect(result).toBe('42');
    });

    it('handles large integers in nested objects', async () => {
      const ctx = makeResponseContext('{"user": {"id": 99999999999999999999}}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.user.id', 'never', 60);
      expect(result).toBe('99999999999999999999');
    });

    it('handles large integers in arrays', async () => {
      const ctx = makeResponseContext('{"ids": [11111111111111111111, 22222222222222222222]}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.ids[0]', 'never', 60);
      expect(result).toBe('11111111111111111111');
    });
  });

  describe('JSONPath body attribute - floating point numbers', () => {
    it('handles a basic float', async () => {
      const ctx = makeResponseContext('{"price": 3.14}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.price', 'never', 60);
      expect(result).toBe('3.14');
    });

    it('handles a negative float', async () => {
      const ctx = makeResponseContext('{"temp": -273.15}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.temp', 'never', 60);
      expect(result).toBe('-273.15');
    });

    it('handles a float with many decimal places', async () => {
      const ctx = makeResponseContext('{"ratio": 0.123456789012345}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.ratio', 'never', 60);
      expect(result).toBe('0.123456789012345');
    });

    it('handles a float in scientific notation', async () => {
      const ctx = makeResponseContext('{"val": 1.5e10}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.val', 'never', 60);
      expect(result).toBe('15000000000');
    });

    it('handles zero', async () => {
      const ctx = makeResponseContext('{"n": 0.0}');
      const result = await responseTag.run(ctx, 'body', 'req_1', '$.n', 'never', 60);
      expect(result).toBe('0');
    });
  });
});

describe('base64 tag', () => {
  describe('encoder', () => {
    const base64EncoderTag = localTemplateTags.find(p => p.templateTag.name === 'base64')?.templateTag;
    invariant(base64EncoderTag, 'missing tag in localTemplateTags');
    it('encodes from normal', () => {
      const encoded = base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'normal', 'hello');
      expect(encoded).toBe('aGVsbG8=');
    });
    it('encodes from hex', () => {
      const encoded = base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'hex', 'abc123');
      expect(encoded).toBe('q8Ej');
    });
    it('errors on invalid action', () => {
      expect(() => base64EncoderTag.run({} as PluginTemplateTagContext, 'transform', 'normal', 'hello')).toThrowError();
    });
    it('errors on invalid kind', () => {
      expect(() => base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'klingon', 'hello')).toThrowError();
    });
  });
});
