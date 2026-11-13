import { generateKeySync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  createFieldDecryptionFailureReport,
  createFieldEncryptionHooks,
  getHooksForType,
  reconcileFieldDecryptionFailures,
} from './hooks';
import { ENCRYPTED_VALUE_PREFIX, encryptValue } from './value';

const PATHS: Record<string, string[]> = {
  Request: ['authentication.password', 'authentication.token', 'authentication.value'],
  CookieJar: ['cookies[].value'],
  ClientCertificate: ['passphrase', 'cert'],
};
const getEncryptedFieldPaths = (type: string) => PATHS[type] ?? [];

const key = generateKeySync('aes', { length: 256 });
const otherKey = generateKeySync('aes', { length: 256 });

const setup = (hookKey = key) => {
  const failureReport = createFieldDecryptionFailureReport();
  const hooks = createFieldEncryptionHooks(hookKey, { getEncryptedFieldPaths, failureReport });
  return { ...hooks, failureReport };
};
const line = (doc: unknown) => JSON.stringify(doc);
const parse = (serialized: string) => JSON.parse(serialized);

const request = (overrides: Record<string, unknown> = {}): Record<string, any> => ({
  _id: 'req_1',
  type: 'Request',
  name: 'My request',
  url: 'https://example.com',
  authentication: { type: 'bearer', token: 'secret-token', prefix: 'Bearer' },
  ...overrides,
});

describe('createFieldEncryptionHooks()', () => {
  it('returns hooks that disable NeDB self-test and rejects invalid keys', () => {
    const failureReport = createFieldDecryptionFailureReport();
    expect(setup().testSerializationHooks).toBe(false);
    expect(() => createFieldEncryptionHooks(undefined as never, { getEncryptedFieldPaths, failureReport })).toThrow();
  });
});

describe('getHooksForType()', () => {
  it('gives the hooks to a type that has encrypted fields, and nothing to a type without or an unknown one', () => {
    const hooks = setup();
    expect(getHooksForType(hooks, 'Request', getEncryptedFieldPaths)).toBe(hooks);
    expect(getHooksForType(hooks, 'CookieJar', getEncryptedFieldPaths)).toBe(hooks);
    expect(getHooksForType(hooks, 'Response', getEncryptedFieldPaths)).toEqual({});
    expect(getHooksForType(hooks, 'NoSuchType', getEncryptedFieldPaths)).toEqual({});
  });
});

describe('afterSerialization', () => {
  it('encrypts non-empty strings on encrypted paths and leaves everything else readable', () => {
    const { afterSerialization } = setup();
    const written = parse(
      afterSerialization(line(request({ authentication: { type: 'basic', username: 'u', password: 'p' } }))),
    );
    expect(written.authentication.password.startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
    expect(written.authentication.username).toBe('u');
    expect(written.authentication.type).toBe('basic');
    expect(written).toMatchObject({ _id: 'req_1', type: 'Request', name: 'My request', url: 'https://example.com' });
  });

  it('never leaves the plaintext of an encrypted value in the line', () => {
    const { afterSerialization } = setup();
    expect(afterSerialization(line(request()))).not.toContain('secret-token');
  });

  it('encrypts every element of arrays', () => {
    const { afterSerialization } = setup();
    const written = parse(
      afterSerialization(
        line({
          _id: 'jar_1',
          type: 'CookieJar',
          cookies: [
            { key: 'a', value: '1' },
            { key: 'b', value: '2' },
          ],
        }),
      ),
    );
    expect(written.cookies.map((c: { value: string }) => c.value.startsWith(ENCRYPTED_VALUE_PREFIX))).toEqual([
      true,
      true,
    ]);
    expect(written.cookies.map((c: { key: string }) => c.key)).toEqual(['a', 'b']);
  });

  it('writes null, empty strings and non-string values on encrypted paths unchanged, without throwing', () => {
    const { afterSerialization } = setup();
    for (const value of [null, '', 0, 42, true, false, { nested: 'x' }, ['a', 'b']]) {
      const doc = request({ authentication: { type: 'bearer', token: value } });
      expect(parse(afterSerialization(line(doc))).authentication.token).toEqual(value);
    }
  });

  it('keeps an absent field absent', () => {
    const { afterSerialization } = setup();
    expect(parse(afterSerialization(line(request({ authentication: { type: 'none' } }))))).toEqual(
      request({ authentication: { type: 'none' } }),
    );
  });

  it('writes values that already start with the prefix unchanged, never encrypting them again', () => {
    const { afterSerialization } = setup();
    for (const value of [
      encryptValue(otherKey, 'from another key'),
      encryptValue(key, 'from this key'),
      `${ENCRYPTED_VALUE_PREFIX}truncated`,
      ENCRYPTED_VALUE_PREFIX,
    ]) {
      const written = parse(afterSerialization(line(request({ authentication: { type: 'bearer', token: value } }))));
      expect(written.authentication.token).toBe(value);
    }
  });

  it('does not touch values off the encrypted paths', () => {
    const { afterSerialization } = setup();
    const doc = request({
      body: { text: 'a plain body' },
      headers: [{ name: 'X-Secret', value: 'header-value' }],
      description: 'description',
    });
    const written = parse(afterSerialization(line(doc)));
    expect(written.body).toEqual(doc.body);
    expect(written.headers).toEqual(doc.headers);
    expect(written.description).toBe('description');
  });

  it('leaves documents of types without encrypted fields, and lines without a type, equivalent', () => {
    const { afterSerialization } = setup();
    for (const doc of [
      { _id: 'wrk_1', type: 'Workspace', name: 'token' },
      { $$deleted: true, _id: 'req_1' },
      { _id: 'x', token: 'no type' },
    ]) {
      expect(parse(afterSerialization(line(doc)))).toEqual(doc);
    }
  });

  it('keeps NeDB date and index markers intact', () => {
    const { afterSerialization } = setup();
    const doc = { _id: 'req_1', type: 'Request', created: { $$date: 1_700_000_000_000 } };
    expect(parse(afterSerialization(line(doc)))).toEqual(doc);
  });

  it('throws instead of writing plaintext when encryption itself fails', () => {
    // Passes the key check of the hook factory, but is not a real KeyObject, so `createCipheriv` rejects it
    const fakeKey = { type: 'secret', symmetricKeySize: 32 } as unknown as typeof key;
    const { afterSerialization } = setup(fakeKey);
    let thrown: unknown;
    try {
      afterSerialization(line(request()));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('authentication.token');
    expect((thrown as Error).message).not.toContain('secret-token');
    expect((thrown as Error).cause).toBeInstanceOf(Error);
  });

  it('throws on a line that is not JSON rather than guessing', () => {
    const { afterSerialization } = setup();
    expect(() => afterSerialization('not json')).toThrow();
  });
});

describe('beforeDeserialization', () => {
  it('decrypts values on encrypted paths and reports nothing', () => {
    const { afterSerialization, beforeDeserialization, failureReport } = setup();
    const doc = request({ authentication: { type: 'basic', username: 'u', password: 'p' } });
    expect(parse(beforeDeserialization(afterSerialization(line(doc))))).toEqual(doc);
    expect(failureReport.list()).toEqual([]);
  });

  it('decrypts every element of arrays', () => {
    const { afterSerialization, beforeDeserialization } = setup();
    const doc = {
      _id: 'jar_1',
      type: 'CookieJar',
      cookies: [{ key: 'a', value: '1' }, { key: 'b', value: '' }, { key: 'c' }],
    };
    expect(parse(beforeDeserialization(afterSerialization(line(doc))))).toEqual(doc);
  });

  it('reads plaintext (not yet migrated) values as they are', () => {
    const { beforeDeserialization, failureReport } = setup();
    const doc = request();
    expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
    expect(failureReport.list()).toEqual([]);
  });

  it('returns a line without any ciphertext untouched, without parsing it or looking up the paths', () => {
    const failureReport = createFieldDecryptionFailureReport();
    const getPaths = vi.fn(getEncryptedFieldPaths);
    const { beforeDeserialization } = createFieldEncryptionHooks(key, {
      getEncryptedFieldPaths: getPaths,
      failureReport,
    });
    // Not what JSON.stringify would write, so parsing and stringifying it again would change it
    const original = '{ "_id": "req_1", "type": "Request",  "authentication": { "token": "plain" } }';
    expect(beforeDeserialization(original)).toBe(original);
    expect(getPaths).not.toHaveBeenCalled();
    expect(failureReport.list()).toEqual([]);
  });

  it('still decrypts a line that holds ciphertext, however it is laid out', () => {
    const { beforeDeserialization } = setup();
    const ciphertext = encryptValue(key, 'secret-token');
    const original = `{ "_id": "req_1", "type": "Request", "authentication": { "token": "${ciphertext}" } }`;
    expect(parse(beforeDeserialization(original)).authentication.token).toBe('secret-token');
  });

  it('reads null, empty and non-string values on encrypted paths unchanged', () => {
    const { beforeDeserialization, failureReport } = setup();
    for (const value of [null, '', 0, 42, true, { nested: 'x' }, ['a']]) {
      const doc = request({ authentication: { type: 'bearer', token: value } });
      expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
    }
    expect(failureReport.list()).toEqual([]);
  });

  describe('failures keep the original value, load the document, and are reported', () => {
    const encryptedWith = (hookKey: typeof key, doc: ReturnType<typeof request>) =>
      setup(hookKey).afterSerialization(line(doc));

    it('wrong key', () => {
      const written = encryptedWith(otherKey, request());
      const { beforeDeserialization, failureReport } = setup();
      const loaded = parse(beforeDeserialization(written));
      expect(loaded.authentication.token).toBe(parse(written).authentication.token);
      expect(loaded).toMatchObject({ _id: 'req_1', type: 'Request', name: 'My request' });
      expect(failureReport.list()).toEqual([{ type: 'Request', _id: 'req_1', path: 'authentication.token' }]);
    });

    it('tampered ciphertext', () => {
      const written = parse(encryptedWith(key, request()));
      const token: string = written.authentication.token;
      const payload = Buffer.from(token.slice(ENCRYPTED_VALUE_PREFIX.length), 'base64');
      payload[payload.length - 1] ^= 0x01;
      written.authentication.token = ENCRYPTED_VALUE_PREFIX + payload.toString('base64');
      const { beforeDeserialization, failureReport } = setup();
      const loaded = parse(beforeDeserialization(line(written)));
      expect(loaded.authentication.token).toBe(written.authentication.token);
      expect(failureReport.list()).toEqual([{ type: 'Request', _id: 'req_1', path: 'authentication.token' }]);
    });

    it('reports concrete array paths and only the failing fields of a document', () => {
      const good = setup(key).afterSerialization(
        line({ _id: 'jar_1', type: 'CookieJar', cookies: [{ key: 'a', value: 'good' }] }),
      );
      const bad = setup(otherKey).afterSerialization(
        line({ _id: 'jar_1', type: 'CookieJar', cookies: [{ key: 'b', value: 'bad' }] }),
      );
      const mixed = parse(good);
      mixed.cookies.push(parse(bad).cookies[0]);
      const { beforeDeserialization, failureReport } = setup();
      const loaded = parse(beforeDeserialization(line(mixed)));
      expect(loaded.cookies[0].value).toBe('good');
      expect(loaded.cookies[1].value).toBe(mixed.cookies[1].value);
      expect(failureReport.list()).toEqual([{ type: 'CookieJar', _id: 'jar_1', path: 'cookies[1].value' }]);
    });

    it('one failing field does not stop the remaining fields from decrypting', () => {
      const bad = parse(encryptedWith(otherKey, request({ authentication: { type: 'x', password: 'bad-pw' } })));
      const good = parse(encryptedWith(key, request({ authentication: { type: 'x', token: 'good-token' } })));
      const doc = { ...good, authentication: { ...good.authentication, password: bad.authentication.password } };
      const { beforeDeserialization, failureReport } = setup();
      const loaded = parse(beforeDeserialization(line(doc)));
      expect(loaded.authentication.token).toBe('good-token');
      expect(loaded.authentication.password).toBe(bad.authentication.password);
      expect(failureReport.list()).toEqual([{ type: 'Request', _id: 'req_1', path: 'authentication.password' }]);
    });

    it('reports each affected field once even if the same line is read repeatedly', () => {
      const written = encryptedWith(otherKey, request());
      const { beforeDeserialization, failureReport } = setup();
      beforeDeserialization(written);
      beforeDeserialization(written);
      expect(failureReport.list()).toHaveLength(1);
    });

    it('failed values survive a read + write round trip byte for byte, and decrypt once the right key is back', () => {
      const written = encryptedWith(otherKey, request());
      const wrong = setup();
      const rewritten = wrong.afterSerialization(wrong.beforeDeserialization(written));
      expect(parse(rewritten).authentication.token).toBe(parse(written).authentication.token);
      const right = setup(otherKey);
      expect(parse(right.beforeDeserialization(rewritten)).authentication.token).toBe('secret-token');
    });
  });

  describe('lookalikes are plaintext: kept verbatim, not decrypted, not reported', () => {
    const lookalikes = {
      'truncated': `${ENCRYPTED_VALUE_PREFIX}${Buffer.alloc(27, 1).toString('base64')}`,
      'not base64': `${ENCRYPTED_VALUE_PREFIX}not*base64*at*all!!`,
      'wrong padding': `${ENCRYPTED_VALUE_PREFIX}${Buffer.alloc(40, 1).toString('base64').slice(0, -1)}`,
      'prefix only': ENCRYPTED_VALUE_PREFIX,
    };

    for (const [name, value] of Object.entries(lookalikes)) {
      it(`malformed value on an encrypted path: ${name}`, () => {
        const { beforeDeserialization, failureReport } = setup();
        const doc = request({ authentication: { type: 'bearer', token: value } });
        expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
        expect(failureReport.list()).toEqual([]);
      });
    }

    it('truncated ciphertext is written back unchanged', () => {
      const { afterSerialization, beforeDeserialization } = setup();
      const doc = request({ authentication: { type: 'bearer', token: lookalikes.truncated } });
      expect(parse(afterSerialization(beforeDeserialization(line(doc)))).authentication.token).toBe(
        lookalikes.truncated,
      );
    });

    it('well-formed ciphertext on a path that is not encrypted (header, body, url, description)', () => {
      const { beforeDeserialization, failureReport } = setup();
      const valid = encryptValue(key, 'would decrypt fine if it were on an encrypted path');
      const invalid = encryptValue(otherKey, 'would fail if it were on an encrypted path');
      const doc = request({
        url: valid,
        description: invalid,
        body: { mimeType: 'text/plain', text: valid },
        headers: [
          { name: 'X-A', value: valid },
          { name: 'X-B', value: invalid },
        ],
      });
      expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
      expect(failureReport.list()).toEqual([]);
    });

    it('lookalike on a type without encrypted fields', () => {
      const { beforeDeserialization, failureReport } = setup();
      const doc = { _id: 'wrk_1', type: 'Workspace', name: encryptValue(key, 'x') };
      expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
      expect(failureReport.list()).toEqual([]);
    });
  });

  describe('never throws, never drops the line', () => {
    it('returns an unparseable line unchanged', () => {
      const { beforeDeserialization, failureReport } = setup();
      for (const bad of ['', 'not json', '{"_id":"req_1","type":"Request"', '{"a":', 'null', '[]', '42', '"text"']) {
        expect(beforeDeserialization(bad)).toBe(bad);
      }
      expect(failureReport.list()).toEqual([]);
    });

    it('returns a loadable line and logs the error, but not the line, when the path lookup itself fails', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failureReport = createFieldDecryptionFailureReport();
      const { beforeDeserialization } = createFieldEncryptionHooks(key, {
        getEncryptedFieldPaths: () => {
          throw new Error('path table broken');
        },
        failureReport,
      });
      const original = line(request({ authentication: { type: 'bearer', token: encryptValue(key, 'secret-token') } }));
      expect(beforeDeserialization(original)).toBe(original);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0][1])).toContain('path table broken');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-token');
      consoleError.mockRestore();
    });

    it('handles a line with no type or an odd _id', () => {
      const { beforeDeserialization } = setup();
      for (const doc of [{ _id: 'x' }, { $$deleted: true, _id: 'req_1' }, { type: 5 }, { type: null }]) {
        expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
      }
      const { beforeDeserialization: other, failureReport } = setup();
      const written = setup(otherKey).afterSerialization(line(request({ _id: undefined })));
      expect(() => other(written)).not.toThrow();
      expect(failureReport.list()).toHaveLength(1);
    });
  });
});

describe('simulated load + rewrite of a datastore file', () => {
  it('keeps the document count, preserves failures byte for byte, and reports exactly the affected fields', () => {
    const writer = setup(key);
    const foreign = setup(otherKey);
    const lines = [
      writer.afterSerialization(line(request({ _id: 'req_ok' }))),
      foreign.afterSerialization(line(request({ _id: 'req_foreign' }))),
      line(request({ _id: 'req_plaintext' })),
      line(
        request({ _id: 'req_lookalike', authentication: { type: 'bearer', token: `${ENCRYPTED_VALUE_PREFIX}short` } }),
      ),
      line(request({ _id: 'req_header_lookalike', headers: [{ name: 'h', value: encryptValue(otherKey, 'x') }] })),
      line({ _id: 'wrk_1', type: 'Workspace', name: 'ws' }),
      'this line is corrupt',
    ];
    const reader = setup(key);
    const loaded = lines.map(l => reader.beforeDeserialization(l));
    const rewritten = loaded.map(l => (l === 'this line is corrupt' ? l : reader.afterSerialization(l)));

    expect(rewritten).toHaveLength(lines.length);
    expect(rewritten[6]).toBe('this line is corrupt');
    // failed and lookalike values are preserved byte for byte
    expect(parse(rewritten[1]).authentication.token).toBe(parse(lines[1]).authentication.token);
    expect(parse(rewritten[3]).authentication.token).toBe(parse(lines[3]).authentication.token);
    expect(parse(rewritten[4]).headers).toEqual(parse(lines[4]).headers);
    // plaintext is encrypted on rewrite
    expect(rewritten[2]).not.toContain('secret-token');
    expect(parse(reader.beforeDeserialization(rewritten[2]))).toEqual(parse(lines[2]));
    expect(reader.failureReport.list()).toEqual([
      { type: 'Request', _id: 'req_foreign', path: 'authentication.token' },
    ]);
  });
});

describe('reconcileFieldDecryptionFailures', () => {
  const failure = (_id: string, path = 'authentication.token', type = 'Request') => ({ type, _id, path });
  const ciphertext = encryptValue(otherKey, 'x');
  const reportOf = (...failures: ReturnType<typeof failure>[]) => {
    const report = createFieldDecryptionFailureReport();
    failures.forEach(report.add);
    return report;
  };
  const reconcile = async (
    report: ReturnType<typeof reportOf>,
    documents: Record<string, unknown>,
    findDocument = vi.fn(async (_type: string, _id: string) => documents[_id]),
  ) => {
    await reconcileFieldDecryptionFailures(report, getEncryptedFieldPaths, findDocument);
    return { failures: report.list(), findDocument };
  };

  it('keeps a failure while the document still holds well-formed ciphertext at that path', async () => {
    const { failures } = await reconcile(reportOf(failure('req_1')), {
      req_1: { authentication: { token: ciphertext } },
    });
    expect(failures).toEqual([failure('req_1')]);
  });

  it('drops a failure whose document was deleted or whose value was replaced', async () => {
    const { failures } = await reconcile(
      reportOf(failure('req_deleted'), failure('req_replaced'), failure('req_kept')),
      {
        req_deleted: null,
        req_replaced: { authentication: { token: 'now plaintext' } },
        req_kept: { authentication: { token: ciphertext } },
      },
    );
    expect(failures).toEqual([failure('req_kept')]);
  });

  it('drops a failure whose path no longer holds a string, or does not exist', async () => {
    const { failures } = await reconcile(reportOf(failure('req_1'), failure('req_2')), {
      req_1: { authentication: { token: null } },
      req_2: { authentication: {} },
    });
    expect(failures).toEqual([]);
  });

  it('reconciles array paths by their concrete path', async () => {
    const { failures } = await reconcile(
      reportOf(failure('jar_1', 'cookies[0].value', 'CookieJar'), failure('jar_1', 'cookies[1].value', 'CookieJar')),
      { jar_1: { cookies: [{ value: 'plaintext' }, { value: ciphertext }] } },
    );
    expect(failures).toEqual([failure('jar_1', 'cookies[1].value', 'CookieJar')]);
  });

  it('looks every document up once, however many of its fields failed', async () => {
    const { failures, findDocument } = await reconcile(
      reportOf(failure('req_1', 'authentication.token'), failure('req_1', 'authentication.password'), failure('req_2')),
      {
        req_1: { authentication: { token: ciphertext, password: 'plaintext' } },
        req_2: { authentication: { token: ciphertext } },
      },
    );
    expect(findDocument).toHaveBeenCalledTimes(2);
    expect(failures).toEqual([failure('req_1', 'authentication.token'), failure('req_2')]);
  });

  it('keeps a failure whose document cannot be looked up, so that it stays visible', async () => {
    const { failures } = await reconcile(
      reportOf(failure('req_1')),
      {},
      vi.fn(async () => {}),
    );
    expect(failures).toEqual([failure('req_1')]);
  });
});
