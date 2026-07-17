/**
 * Necessary because implementation assumes browser environment, e.g. Node.ELEMENT_NODE
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

import { invariant } from '~/common/utils/invariant';

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
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        'count(//book)',
        'never',
        60,
      );
      expect(result).toBe('2');
    });

    it('handles sum() returning a number', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        'sum(//price)',
        'never',
        60,
      );
      expect(result).toBe('18.98');
    });

    it('handles boolean() returning true', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        'boolean(//book)',
        'never',
        60,
      );
      expect(result).toBe('true');
    });

    it('handles boolean() returning false', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        'boolean(//missing)',
        'never',
        60,
      );
      expect(result).toBe('false');
    });

    it('handles string() returning a string', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        'string(//title[1])',
        'never',
        60,
      );
      expect(result).toBe('Gatsby');
    });

    it('returns inner text for an element node query', async () => {
      // /store/book[1]/title is unambiguous — only one <title> under the first <book>
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        '/store/book[1]/title',
        'never',
        60,
      );
      expect(result).toBe('Gatsby');
    });

    it('returns nodeValue for an attribute node query', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        '/store/book[1]/@id',
        'never',
        60,
      );
      expect(result).toBe('1');
    });

    it('returns text content for a text() node query', async () => {
      const result = await responseTag.run(
        makeResponseContext(XML, 'application/xml; charset=utf-8'),
        'body',
        'req_1',
        '/store/book[1]/title/text()',
        'never',
        60,
      );
      expect(result).toBe('Gatsby');
    });

    it('throws when query matches no nodes', async () => {
      await expect(
        responseTag.run(
          makeResponseContext(XML, 'application/xml; charset=utf-8'),
          'body',
          'req_1',
          '//missing',
          'never',
          60,
        ),
      ).rejects.toThrow('Invalid XPath query: //missing');
    });

    it('throws when query matches more than one node', async () => {
      await expect(
        responseTag.run(
          makeResponseContext(XML, 'application/xml; charset=utf-8'),
          'body',
          'req_1',
          '//book',
          'never',
          60,
        ),
      ).rejects.toThrow('Invalid XPath query: //book');
    });

    it('throws on a syntactically invalid XPath expression', async () => {
      await expect(
        responseTag.run(
          makeResponseContext(XML, 'application/xml; charset=utf-8'),
          'body',
          'req_1',
          '//[]',
          'never',
          60,
        ),
      ).rejects.toThrow('Invalid XPath query: //[]');
    });
  });
});

describe('base64 tag', () => {
  const base64Tag = localTemplateTags.find(p => p.templateTag.name === 'base64')?.templateTag;
  invariant(base64Tag, 'missing base64 tag in localTemplateTags');

  it('encodes and decodes normal', () => {
    const encoded = base64Tag.run({} as PluginTemplateTagContext, 'encode', 'normal', 'hello');
    const decoded = base64Tag.run({} as PluginTemplateTagContext, 'decode', 'normal', encoded);
    expect(encoded).toBe('aGVsbG8=');
    expect(decoded).toBe('hello');
  });

  it('encodes and decodes hex', () => {
    const encoded = base64Tag.run({} as PluginTemplateTagContext, 'encode', 'hex', 'abc123');
    const decoded = base64Tag.run({} as PluginTemplateTagContext, 'decode', 'hex', encoded);
    expect(encoded).toBe('q8Ej');
    expect(decoded).toBe('abc123');
  });

  it('url encoding replaces + with - and strips padding', () => {
    // '  > ' base64-encodes to 'ICA+IA==', which contains both a '+' and trailing '=',
    // so this asserts the + -> - substitution and padding removal on a real occurrence.
    expect(base64Tag.run({} as PluginTemplateTagContext, 'encode', 'normal', '  > ')).toBe('ICA+IA==');
    expect(base64Tag.run({} as PluginTemplateTagContext, 'encode', 'url', '  > ')).toBe('ICA-IA');
  });

  it('url encoding replaces / with _', () => {
    // '  ? ' base64-encodes to 'ICA/IA==', which contains a '/', so this asserts the
    // / -> _ substitution on a real occurrence.
    expect(base64Tag.run({} as PluginTemplateTagContext, 'encode', 'normal', '  ? ')).toBe('ICA/IA==');
    expect(base64Tag.run({} as PluginTemplateTagContext, 'encode', 'url', '  ? ')).toBe('ICA_IA');
  });

  it('throws on invalid action', () => {
    expect(() => base64Tag.run({} as PluginTemplateTagContext, 'invalid', 'normal', 'hello')).toThrow();
  });

  it('throws on invalid kind', () => {
    expect(() => base64Tag.run({} as PluginTemplateTagContext, 'encode', 'invalid', 'hello')).toThrow();
  });
});

describe('hash tag', () => {
  const hashTag = localTemplateTags.find(p => p.templateTag.name === 'hash')?.templateTag;
  invariant(hashTag, 'missing hash tag in localTemplateTags');

  it('sha1 hex of "abc" matches known digest', async () => {
    const result = await hashTag.run({} as PluginTemplateTagContext, 'sha1', 'hex', 'abc');
    expect(result).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('sha512 hex of "abc" matches known digest', async () => {
    const result = await hashTag.run({} as PluginTemplateTagContext, 'sha512', 'hex', 'abc');
    expect(result).toBe('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
  });

  it('sha256 base64 of "abc" matches known digest', async () => {
    const result = await hashTag.run({} as PluginTemplateTagContext, 'sha256', 'base64', 'abc');
    expect(result).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
  });

  it('throws on invalid encoding', async () => {
    await expect(
      hashTag.run({} as PluginTemplateTagContext, 'sha256', 'bogus', 'abc'),
    ).rejects.toThrow(/Invalid encoding/);
  });

  it('throws on non-string value', async () => {
    await expect(
      hashTag.run({} as PluginTemplateTagContext, 'sha256', 'hex', 123 as any),
    ).rejects.toThrow(/Cannot hash value/);
  });

  it('falls back to SHA-256 for an unrecognised algorithm name', async () => {
    // The tag maps unknown algorithm strings to SHA-256 rather than throwing.
    // This test documents that behaviour so a future change to throw instead is noticed.
    const result = await hashTag.run({} as PluginTemplateTagContext, 'MD4' as any, 'hex', 'abc');
    // SHA-256('abc') = ba7816bf...
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect((result as string).startsWith('ba7816bf')).toBe(true);
  });
});

describe('now tag', () => {
  const nowTag = localTemplateTags.find(p => p.templateTag.name === 'now')?.templateTag;
  invariant(nowTag, 'missing now tag in localTemplateTags');

  it('millis returns an all-digits string', () => {
    const result = nowTag.run({} as PluginTemplateTagContext, 'millis');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+$/);
  });

  it('unix returns an all-digits string', () => {
    const result = nowTag.run({} as PluginTemplateTagContext, 'unix') as string;
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+$/);
  });

  it('iso-8601 matches ISO regex', () => {
    const result = nowTag.run({} as PluginTemplateTagContext, 'iso-8601');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('custom with format "yyyy" returns the current 4-digit year', () => {
    const result = nowTag.run({} as PluginTemplateTagContext, 'custom', 'yyyy');
    expect(result).toBe(String(new Date().getFullYear()));
  });

  it('throws on invalid dateType', () => {
    expect(() => nowTag.run({} as PluginTemplateTagContext, 'bogus')).toThrow(/Invalid date type/);
  });
});

describe('uuid tag', () => {
  const uuidTag = localTemplateTags.find(p => p.templateTag.name === 'uuid')?.templateTag;
  invariant(uuidTag, 'missing uuid tag in localTemplateTags');
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('v4 returns a v4-format UUID', () => {
    const result = uuidTag.run({} as PluginTemplateTagContext, 'v4');
    expect(result).toMatch(UUID_V4_REGEX);
  });

  // NOTE: v1 is not actually implemented — the tag always returns crypto.randomUUID() (v4). This test documents current behavior.
  it('v1 also returns a v4-format UUID (v1 is not implemented)', () => {
    const result = uuidTag.run({} as PluginTemplateTagContext, 'v1');
    expect(result).toMatch(UUID_V4_REGEX);
  });
});

describe('jsonpath tag - standalone', () => {
  const jsonpathTag = localTemplateTags.find(p => p.templateTag.name === 'jsonpath')?.templateTag;
  invariant(jsonpathTag, 'missing jsonpath tag in localTemplateTags');

  it('extracts a value from a small JSON string', async () => {
    const result = await jsonpathTag.run({} as PluginTemplateTagContext, '{"a": {"b": 42}}', '$.a.b');
    expect(result).toBe(42);
  });

  it('throws on invalid JSON', async () => {
    await expect(
      jsonpathTag.run({} as PluginTemplateTagContext, '{not valid json', '$.a'),
    ).rejects.toThrow(/Invalid JSON/);
  });

  it('throws when query matches no results', async () => {
    await expect(
      jsonpathTag.run({} as PluginTemplateTagContext, '{"a": 1}', '$.missing'),
    ).rejects.toThrow(/JSONPath query returned no results/);
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
    const readFile = vi.fn(async () => {
      throw new Error('access denied by secureReadFile');
    });
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
