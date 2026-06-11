/**
 * Necessary because implementation assumes browser environment, e.g. Node.ELEMENT_NODE
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

import { invariant } from '../../utils/invariant';
import { localTemplateTags } from '../local-template-tags';
import { type PluginTemplateTagContext } from '../types';

// Minimal mock context for the response tag
function makeResponseContext(body: string, contentType = 'application/json; charset=utf-8'): PluginTemplateTagContext {
  const bodyBuffer = Buffer.from(body, 'utf8');
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
            contentType,
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

  describe('XPath filters', () => {
    const XML = `<store><book id="1"><title>Gatsby</title><price>9.99</price></book><book id="2"><title>1984</title><price>8.99</price></book></store>`;
    const responseTag = localTemplateTags.find(p => p.templateTag.name === 'response')?.templateTag;
    invariant(responseTag, 'missing tag in localTemplateTags');

    it('handles count() returning a number', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', 'count(//book)', 'never', 60);
      expect(result).toBe('2');
    });

    it('handles sum() returning a number', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', 'sum(//price)', 'never', 60);
      expect(result).toBe('18.98');
    });

    it('handles boolean() returning true', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', 'boolean(//book)', 'never', 60);
      expect(result).toBe('true');
    });

    it('handles boolean() returning false', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', 'boolean(//missing)', 'never', 60);
      expect(result).toBe('false');
    });

    it('handles string() returning a string', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', 'string(//title[1])', 'never', 60);
      expect(result).toBe('Gatsby');
    });

    it('returns inner text for an element node query', async () => {
      // /store/book[1]/title is unambiguous — only one <title> under the first <book>
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '/store/book[1]/title', 'never', 60);
      expect(result).toBe('Gatsby');
    });

    it('returns nodeValue for an attribute node query', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '/store/book[1]/@id', 'never', 60);
      expect(result).toBe('1');
    });

    it('returns text content for a text() node query', async () => {
      const result = await responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '/store/book[1]/title/text()', 'never', 60);
      expect(result).toBe('Gatsby');
    });

    it('throws when query matches no nodes', async () => {
      await expect(
        responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '//missing', 'never', 60),
      ).rejects.toThrow('Invalid XPath query: //missing');
    });

    it('throws when query matches more than one node', async () => {
      await expect(
        responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '//book', 'never', 60),
      ).rejects.toThrow('Invalid XPath query: //book');
    });

    it('throws on a syntactically invalid XPath expression', async () => {
      await expect(
        responseTag.run(makeResponseContext(XML, 'application/xml; charset=utf-8'), 'body', 'req_1', '//[]', 'never', 60),
      ).rejects.toThrow('Invalid XPath query: //[]');
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

describe('file tag: filesystem access isolation', () => {
  const fileTag = localTemplateTags.find(p => p.templateTag.name === 'file')?.templateTag;
  invariant(fileTag, 'missing file tag in localTemplateTags');

  it('reads through context.util.readFile, not fs directly', async () => {
    const readFile = vi.fn(async (_path: string) => 'file-contents');
    const ctx = { util: { readFile } } as unknown as PluginTemplateTagContext;

    const result = await fileTag.run(ctx, '/allowed/path/secret.txt');

    expect(readFile).toHaveBeenCalledOnce();
    expect(readFile).toHaveBeenCalledWith('/allowed/path/secret.txt');
    expect(result).toBe('file-contents');
  });

  it('throws when no path is provided — no fallback fs read occurs', async () => {
    const readFile = vi.fn();
    const ctx = { util: { readFile } } as unknown as PluginTemplateTagContext;

    await expect(fileTag.run(ctx, '')).rejects.toThrow('No file selected');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('propagates errors from context.util.readFile without a fallback', async () => {
    const readFile = vi.fn(async () => { throw new Error('access denied by secureReadFile'); });
    const ctx = { util: { readFile } } as unknown as PluginTemplateTagContext;

    await expect(fileTag.run(ctx, '/sensitive/secrets.txt')).rejects.toThrow('access denied by secureReadFile');
  });

  it('does not expose a direct fs module — only the context bridge is available', async () => {
    // Verify that the tag has no other way to read files: removing readFile from the context
    // must cause a failure, not a silent fallback.
    const ctx = { util: {} } as unknown as PluginTemplateTagContext;
    await expect(fileTag.run(ctx, '/some/path')).rejects.toBeDefined();
  });
});

describe('hash tag: crypto access isolation', () => {
  const hashTag = localTemplateTags.find(p => p.templateTag.name === 'hash')?.templateTag;
  invariant(hashTag, 'missing hash tag in localTemplateTags');

  it('produces a sha256 hex digest using Web Crypto (crypto.subtle)', async () => {
    // "abc" sha256 = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469fa72ffd1e7bf1f5d3 (first 8 bytes for brevity)
    const result = await hashTag.run({} as PluginTemplateTagContext, 'SHA-256', 'hex', 'abc');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect(result.startsWith('ba7816bf')).toBe(true);
  });

  it('produces a sha256 base64 digest', async () => {
    const result = await hashTag.run({} as PluginTemplateTagContext, 'SHA-256', 'base64', 'abc');
    expect(typeof result).toBe('string');
    // base64 of a 32-byte hash is always 44 chars with padding
    expect(result).toHaveLength(44);
  });

  it('falls back to SHA-256 for an unrecognised algorithm name', async () => {
    // The tag maps unknown algorithm strings to SHA-256 rather than throwing.
    // This test documents that behaviour so a future change to throw instead is noticed.
    const result = await hashTag.run({} as PluginTemplateTagContext, 'MD4' as any, 'hex', 'abc');
    // SHA-256('abc') = ba7816bf...
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect((result as string).startsWith('ba7816bf')).toBe(true);
  });

  it('throws on non-string value', async () => {
    await expect(
      hashTag.run({} as PluginTemplateTagContext, 'SHA-256', 'hex', 42 as unknown as string),
    ).rejects.toThrow();
  });
});
