import { generateKeySync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { models } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNedbDatabase } from './database-nedb';
import { createFieldDecryptionFailureReport, createFieldEncryptionHooks } from './field-encryption/hooks';
import { ENCRYPTED_VALUE_PREFIX } from './field-encryption/value';

// These tests use real NeDB datastores in a temporary directory

const key = generateKeySync('aes', { length: 256 });
const otherKey = generateKeySync('aes', { length: 256 });

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-field-encryption-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const open = async (options: { key?: typeof key; dbPath?: string } = {}) => {
  let internals!: {
    getFieldDecryptionFailures: () => unknown[];
    refreshFieldDecryptionFailures: () => Promise<unknown[]>;
    resetFieldDecryptionFailures: () => Promise<number>;
  };
  const db = createNedbDatabase((nedbDatabase, nedbInternals) => {
    internals = nedbInternals;
    return nedbDatabase;
  });
  await db.init({ dbPath: options.dbPath ?? dir, fieldEncryptionKey: options.key });
  return {
    db,
    failures: () => internals.getFieldDecryptionFailures(),
    refresh: () => internals.refreshFieldDecryptionFailures(),
    reset: () => internals.resetFieldDecryptionFailures(),
  };
};

const filePath = (type: string) => path.join(dir, `insomnia.${type}.db`);
const readFile = (type: string) => fs.readFileSync(filePath(type), 'utf8');
const readLines = (type: string) =>
  readFile(type)
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line));
const writeLines = (type: string, lines: (object | string)[]) =>
  fs.writeFileSync(
    filePath(type),
    lines.map(line => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n',
  );

const encryptWith = (encryptionKey: typeof key, doc: object) =>
  createFieldEncryptionHooks(encryptionKey, {
    getEncryptedFieldPaths: models.getEncryptedFieldPathsForType,
    failureReport: createFieldDecryptionFailureReport(),
  }).afterSerialization(JSON.stringify(doc));

const request = (overrides: Record<string, unknown> = {}) => ({
  _id: 'req_1',
  type: 'Request',
  parentId: 'wrk_1',
  name: 'A request',
  url: 'https://example.com',
  authentication: { type: 'bearer', token: 'secret-token' },
  ...overrides,
});

describe('encryption through a real datastore', () => {
  it('writes encrypted values to the file, reads plaintext back, and survives a restart', async () => {
    const { db } = await open({ key });
    await db.insert(
      request({
        headers: [{ name: 'X-Plain', value: 'plain header value' }],
        authentication: { type: 'basic', username: 'user', password: 'secret-password' },
      }) as never,
    );

    const raw = readFile('Request');
    expect(raw).not.toContain('secret-password');
    expect(raw).toContain('plain header value');
    expect(raw).toContain('"username":"user"');
    expect(readLines('Request').at(-1).authentication.password.startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.password).toBe('secret-password');

    const restarted = await open({ key });
    expect((await restarted.db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.password).toBe(
      'secret-password',
    );
    expect(readFile('Request')).not.toContain('secret-password');
    expect(restarted.failures()).toEqual([]);
  });

  it('keeps queries on encrypted fields working, because the in-memory data is plaintext', async () => {
    const { db } = await open({ key });
    await db.insert(request() as never);
    const found = await db.find<any>('Request', { 'authentication.token': 'secret-token' } as never);
    expect(found.map(doc => doc._id)).toEqual(['req_1']);
  });

  it('encrypts updates, not just inserts', async () => {
    const { db } = await open({ key });
    const doc = await db.insert<any>(request() as never);
    await db.update({ ...doc, authentication: { type: 'bearer', token: 'rotated-token' } });
    expect(readFile('Request')).not.toContain('rotated-token');
    const restarted = await open({ key });
    expect((await restarted.db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('rotated-token');
  });

  it('does not encrypt in memory-only instances, and ignores the key there', async () => {
    const db = createNedbDatabase();
    await db.init({ inMemoryOnly: true, fieldEncryptionKey: key });
    await db.insert(request() as never);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('secret-token');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('rejects an invalid key', async () => {
    await expect(open({ key: 'not a key' as never })).rejects.toThrow(/256-bit/);
  });
});

describe('migration: the first load with the key encrypts the existing plaintext', () => {
  const seed = () => {
    writeLines('Request', [request({ _id: 'req_1' }), request({ _id: 'req_2', authentication: { type: 'none' } })]);
    writeLines('CookieJar', [
      {
        _id: 'jar_1',
        type: 'CookieJar',
        parentId: 'wrk_1',
        cookies: [{ key: 'a', value: 'cookie-secret', domain: 'x' }],
      },
    ]);
    writeLines('ClientCertificate', [
      {
        _id: 'crt_1',
        type: 'ClientCertificate',
        parentId: 'wrk_1',
        host: 'client.example.com',
        passphrase: 'cert-passphrase',
        cert: 'CERT-PEM',
        key: null,
        pfx: null,
      },
    ]);
    writeLines('RequestVersion', [
      { _id: 'rvr_1', type: 'RequestVersion', parentId: 'req_1', compressedRequest: 'H4sIAAAAAAAA/compressed-secret' },
    ]);
    writeLines('Workspace', [
      { _id: 'wrk_1', type: 'Workspace', parentId: 'proj_1', name: 'Workspace', scope: 'collection' },
    ]);
  };

  it('encrypts every sensitive field on every datastore, keeps the data and leaves the rest readable', async () => {
    seed();
    const { db, failures } = await open({ key });

    for (const secret of ['secret-token', 'cookie-secret', 'cert-passphrase', 'CERT-PEM', 'compressed-secret']) {
      for (const type of ['Request', 'CookieJar', 'ClientCertificate', 'RequestVersion']) {
        expect(readFile(type), `${type} must not contain ${secret}`).not.toContain(secret);
      }
    }
    expect(readFile('Request')).toContain('https://example.com');
    expect(readFile('ClientCertificate')).toContain('client.example.com');
    expect(readFile('Workspace')).toContain('"name":"Workspace"');

    expect(await db.count('Request')).toBe(2);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('secret-token');
    expect((await db.findOne<any>('CookieJar', { _id: 'jar_1' }))?.cookies[0].value).toBe('cookie-secret');
    expect((await db.findOne<any>('ClientCertificate', { _id: 'crt_1' }))?.passphrase).toBe('cert-passphrase');
    expect((await db.findOne<any>('RequestVersion', { _id: 'rvr_1' }))?.compressedRequest).toBe(
      'H4sIAAAAAAAA/compressed-secret',
    );
    expect(failures()).toEqual([]);
  });

  it('reads a datastore that is partly plaintext and partly encrypted', async () => {
    writeLines('Request', [
      encryptWith(key, request({ _id: 'req_encrypted' })),
      JSON.stringify(request({ _id: 'req_plaintext', authentication: { type: 'bearer', token: 'plain-token' } })),
    ]);
    const { db, failures } = await open({ key });
    expect((await db.findOne<any>('Request', { _id: 'req_encrypted' }))?.authentication.token).toBe('secret-token');
    expect((await db.findOne<any>('Request', { _id: 'req_plaintext' }))?.authentication.token).toBe('plain-token');
    expect(readFile('Request')).not.toContain('plain-token');
    expect(failures()).toEqual([]);
  });

  it('encrypts again on every launch without changing the data', async () => {
    seed();
    await open({ key });
    const second = await open({ key });
    expect(await second.db.count('Request')).toBe(2);
    expect((await second.db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('secret-token');
  });
});

describe('the load rewrite never loses documents', () => {
  it('keeps the document count, applies the latest line of a document, and does not resurrect deleted documents', async () => {
    writeLines('Request', [
      request({ _id: 'req_1', name: 'first' }),
      request({ _id: 'req_2' }),
      request({ _id: 'req_1', name: 'updated', authentication: { type: 'bearer', token: 'new-token' } }),
      { $$deleted: true, _id: 'req_2' },
      request({ _id: 'req_3' }),
    ]);
    const { db } = await open({ key });
    expect((await db.find<any>('Request')).map(doc => doc._id).sort()).toEqual(['req_1', 'req_3']);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.name).toBe('updated');
    expect(readLines('Request')).toHaveLength(2);
  });

  it('handles corrupt lines exactly as without encryption', async () => {
    const lines = [...Array.from({ length: 9 }, (_, i) => request({ _id: `req_${i}` })), 'this line is corrupt'];
    writeLines('Request', lines);
    const withKey = await open({ key });
    const ids = (await withKey.db.find<any>('Request')).map(doc => doc._id).sort();

    writeLines('Request', lines);
    const withoutKey = await open();
    expect((await withoutKey.db.find<any>('Request')).map(doc => doc._id).sort()).toEqual(ids);
    expect(ids).toHaveLength(9);
  });

  it('refuses to load a file that is mostly corrupt, with or without encryption', async () => {
    // NeDB refuses a file in which more than 90% of the lines are corrupt
    writeLines('Request', [...Array.from({ length: 10 }, (_, i) => `garbage ${i}`), request()]);
    await expect(open({ key })).rejects.toThrow(/Request/);
    await expect(open()).rejects.toThrow(/Request/);
  });
});

describe('failed decryption', () => {
  const seedWithOtherKey = () =>
    writeLines('Request', [
      encryptWith(otherKey, request({ _id: 'req_1' })),
      encryptWith(otherKey, request({ _id: 'req_2', authentication: { type: 'basic', password: 'pw' } })),
    ]);

  it('loads every document, keeps the values byte for byte through the rewrite, and reports exactly the affected fields', async () => {
    seedWithOtherKey();
    const before = readLines('Request');
    const { db, failures } = await open({ key });

    expect(await db.count('Request')).toBe(2);
    expect(readLines('Request')).toEqual(before);
    expect(failures()).toEqual([
      { type: 'Request', _id: 'req_1', path: 'authentication.token' },
      { type: 'Request', _id: 'req_2', path: 'authentication.password' },
    ]);
    const doc = await db.findOne<any>('Request', { _id: 'req_1' });
    expect(doc?.authentication.token.startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
    expect(doc?.name).toBe('A request');

    // the values are recoverable once the right key is back
    const recovered = await open({ key: otherKey });
    expect((await recovered.db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('secret-token');
    expect(recovered.failures()).toEqual([]);
  });

  it('does not report fields of documents that were replaced or deleted by a later line', async () => {
    writeLines('Request', [
      encryptWith(otherKey, request({ _id: 'req_replaced' })),
      encryptWith(otherKey, request({ _id: 'req_deleted' })),
      encryptWith(otherKey, request({ _id: 'req_failing' })),
      encryptWith(key, request({ _id: 'req_replaced', authentication: { type: 'bearer', token: 'fresh' } })),
      { $$deleted: true, _id: 'req_deleted' },
    ]);
    const { db, failures } = await open({ key });
    expect(failures()).toEqual([{ type: 'Request', _id: 'req_failing', path: 'authentication.token' }]);
    expect((await db.findOne<any>('Request', { _id: 'req_replaced' }))?.authentication.token).toBe('fresh');
    expect(await db.count('Request')).toBe(2);
  });

  it('starts with an empty report on every init()', async () => {
    seedWithOtherKey();
    const failedOpen = await open({ key });
    expect(failedOpen.failures()).toHaveLength(2);
    const reopened = await open({ key: otherKey, dbPath: dir });
    expect(reopened.failures()).toEqual([]);
  });

  it('does not report values that only look like ciphertext', async () => {
    writeLines('Request', [
      request({
        _id: 'req_1',
        authentication: { type: 'bearer', token: `${ENCRYPTED_VALUE_PREFIX}short` },
        headers: [{ name: 'h', value: encryptWith(otherKey, request()) }],
        description: `${ENCRYPTED_VALUE_PREFIX}${Buffer.alloc(40, 1).toString('base64')}`,
      }),
    ]);
    const { failures } = await open({ key });
    expect(failures()).toEqual([]);
  });
});

describe('keeping the failure report current after the load', () => {
  const seedWithOtherKey = () =>
    writeLines('Request', [
      encryptWith(otherKey, request({ _id: 'req_1' })),
      encryptWith(otherKey, request({ _id: 'req_2', authentication: { type: 'basic', password: 'pw' } })),
    ]);

  it('resetting clears the failed fields, keeps the rest of the documents and empties the report', async () => {
    seedWithOtherKey();
    const { db, failures, reset } = await open({ key });
    expect(failures()).toHaveLength(2);

    expect(await reset()).toBe(2);

    expect(failures()).toEqual([]);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication).toEqual({ type: 'bearer', token: '' });
    expect((await db.findOne<any>('Request', { _id: 'req_2' }))?.authentication.password).toBe('');
    expect((await db.findOne<any>('Request', { _id: 'req_2' }))?.name).toBe('A request');
    expect(await db.count('Request')).toBe(2);
    // The file is append-only until the next load, so the latest line of each document is what counts
    expect(
      readLines('Request')
        .slice(-2)
        .map(line => line.authentication),
    ).toEqual([
      { type: 'bearer', token: '' },
      { type: 'basic', password: '' },
    ]);

    // a new launch has nothing to report
    const restarted = await open({ key });
    expect(restarted.failures()).toEqual([]);
    expect((await restarted.db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('');
  });

  it('clears only the failed fields of a document, and resets a field inside an array', async () => {
    writeLines('CookieJar', [
      encryptWith(otherKey, {
        _id: 'jar_1',
        type: 'CookieJar',
        parentId: 'wrk_1',
        cookies: [
          { key: 'a', value: 'first', domain: 'x' },
          { key: 'b', value: 'second', domain: 'x' },
        ],
      }),
    ]);
    const { db, reset, failures } = await open({ key });
    expect(failures().map((failure: any) => failure.path)).toEqual(['cookies[0].value', 'cookies[1].value']);

    await db.update({
      ...(await db.findOne<any>('CookieJar', { _id: 'jar_1' })),
      cookies: [
        { key: 'a', value: 'typed again', domain: 'x' },
        ...(await db.findOne<any>('CookieJar', { _id: 'jar_1' }))!.cookies.slice(1),
      ],
    });

    expect(await reset()).toBe(1);
    const jar = await db.findOne<any>('CookieJar', { _id: 'jar_1' });
    expect(jar?.cookies.map((cookie: any) => [cookie.key, cookie.value])).toEqual([
      ['a', 'typed again'],
      ['b', ''],
    ]);
  });

  it('clears several failed fields under the same top-level key in one update, and keeps their siblings', async () => {
    writeLines('CookieJar', [
      encryptWith(otherKey, {
        _id: 'jar_1',
        type: 'CookieJar',
        parentId: 'wrk_1',
        cookies: [
          { key: 'a', value: 'first', domain: 'x' },
          { key: 'b', value: 'second', domain: 'x' },
          { key: 'c', value: 'third', domain: 'x' },
        ],
      }),
    ]);
    const { db, reset, failures } = await open({ key });
    expect(failures()).toHaveLength(3);
    const listener = vi.fn();
    db.onChange(listener);

    expect(await reset()).toBe(3);

    const jar = await db.findOne<any>('CookieJar', { _id: 'jar_1' });
    expect(jar?.cookies.map((cookie: any) => [cookie.key, cookie.value, cookie.domain])).toEqual([
      ['a', '', 'x'],
      ['b', '', 'x'],
      ['c', '', 'x'],
    ]);
    expect(failures()).toEqual([]);
    // one update for the document, whose patch holds the whole array with every field cleared
    expect(listener).toHaveBeenCalledTimes(1);
    const [[event, , patches]] = listener.mock.calls[0][0];
    expect(event).toBe('update');
    expect(patches[0].cookies.map((cookie: any) => cookie.value)).toEqual(['', '', '']);
    // and what is on disk is what is in memory
    const restarted = await open({ key });
    expect(
      (await restarted.db.findOne<any>('CookieJar', { _id: 'jar_1' }))?.cookies.map((cookie: any) => cookie.value),
    ).toEqual(['', '', '']);
  });

  it('refreshing drops a field the user edited after the load, and a document that was removed', async () => {
    seedWithOtherKey();
    const { db, refresh, reset } = await open({ key });

    const edited = await db.findOne<any>('Request', { _id: 'req_1' });
    await db.update({ ...edited, authentication: { type: 'bearer', token: 'typed after the load' } });
    expect(await refresh()).toEqual([{ type: 'Request', _id: 'req_2', path: 'authentication.password' }]);

    await db.remove((await db.findOne<any>('Request', { _id: 'req_2' }))!);
    expect(await refresh()).toEqual([]);
    expect(await reset()).toBe(0);
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('typed after the load');
  });

  it('does not overwrite a value typed after the report was made, even if the report is stale', async () => {
    seedWithOtherKey();
    const { db, reset } = await open({ key });
    const typedLater = await db.findOne<any>('Request', { _id: 'req_1' });
    // The update goes through the datastore directly, so the report is not refreshed in between
    await db.update({ ...typedLater, authentication: { type: 'bearer', token: 'typed later' } });

    await reset();
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('typed later');
  });

  it('notifies change listeners once for the whole reset', async () => {
    seedWithOtherKey();
    const { db, reset } = await open({ key });
    const listener = vi.fn();
    db.onChange(listener);
    await reset();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].map(([event, doc]: any) => [event, doc._id])).toEqual([
      ['update', 'req_1'],
      ['update', 'req_2'],
    ]);
  });
});

describe('options', () => {
  it('always loads the datastores, even when the caller asks for autoload: false', async () => {
    writeLines('Request', [encryptWith(key, request())]);
    const db = createNedbDatabase();
    await db.init({ dbPath: dir, fieldEncryptionKey: key, autoload: false });
    expect((await db.findOne<any>('Request', { _id: 'req_1' }))?.authentication.token).toBe('secret-token');
  });
});

describe('hooks per datastore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the hooks for exactly the types that have encrypted fields, and loads the other types as they are', async () => {
    const pathsByType = models.getEncryptedFieldPathsByType();
    const types = Object.keys(pathsByType);
    for (const type of types) {
      writeLines(type, [{ _id: `${type}_1`, type, parentId: 'wrk_1', name: `A ${type}` }]);
    }
    const lookedUp = new Set<string>();
    const getPaths = models.getEncryptedFieldPathsForType;
    vi.spyOn(models, 'getEncryptedFieldPathsForType').mockImplementation(type => {
      lookedUp.add(type);
      return getPaths(type);
    });

    await open({ key });

    const typesWithEncryptedFields = Object.entries(pathsByType)
      .filter(([, paths]) => paths.length > 0)
      .map(([type]) => type);
    expect(typesWithEncryptedFields.length).toBeGreaterThan(0);
    expect(typesWithEncryptedFields.length).toBeLessThan(types.length);
    expect([...lookedUp].sort()).toEqual(typesWithEncryptedFields.sort());
    // The startup repairs may remove documents that belong to nothing, so check what the load rewrote into the files
    for (const type of types) {
      expect(readFile(type), `${type} must be loaded and rewritten`).toContain(`"name":"A ${type}"`);
    }
  });
});

describe('degraded mode: no key', () => {
  it('loads encrypted values verbatim without losing them, and the next keyed launch decrypts and encrypts', async () => {
    writeLines('Request', [encryptWith(key, request({ _id: 'req_encrypted' }))]);
    const encryptedToken = readLines('Request')[0].authentication.token;

    const degraded = await open();
    const doc = await degraded.db.findOne<any>('Request', { _id: 'req_encrypted' });
    expect(doc?.authentication.token).toBe(encryptedToken);
    // a secret written during the degraded session is plaintext
    await degraded.db.insert(
      request({ _id: 'req_degraded', authentication: { type: 'bearer', token: 'degraded-token' } }) as never,
    );
    expect(readFile('Request')).toContain('degraded-token');
    expect(readLines('Request').find(line => line._id === 'req_encrypted').authentication.token).toBe(encryptedToken);

    const healthy = await open({ key });
    expect(readFile('Request')).not.toContain('degraded-token');
    expect((await healthy.db.findOne<any>('Request', { _id: 'req_degraded' }))?.authentication.token).toBe(
      'degraded-token',
    );
    expect((await healthy.db.findOne<any>('Request', { _id: 'req_encrypted' }))?.authentication.token).toBe(
      'secret-token',
    );
    expect(healthy.failures()).toEqual([]);
  });
});

describe('load failures surface as errors instead of hangs', () => {
  const unhandled = vi.fn();
  beforeEach(() => {
    unhandled.mockClear();
    process.on('unhandledRejection', unhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', unhandled);
    vi.restoreAllMocks();
  });

  const corrupt = (type: string) =>
    writeLines(type, [...Array.from({ length: 10 }, (_, i) => `garbage ${i}`), request()]);

  it('rejects init() with an error naming the datastore whose load failed, with no unhandled rejection', async () => {
    corrupt('Request');
    await expect(open({ key })).rejects.toThrow('Failed to load datastores: Request (');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('names every failed datastore', async () => {
    corrupt('Request');
    corrupt('Workspace');
    const error = await open().catch(e => e);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain('Request (');
    expect(error.message).toContain('Workspace (');
    expect(error.errors).toHaveLength(2);
  });

  it('fails the load, leaves the file untouched and does not hang when a hook throws during the rewrite', async () => {
    writeLines('Request', [request()]);
    const before = readFile('Request');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // the encrypt hook looks up the paths of every document it rewrites
    vi.spyOn(models, 'getEncryptedFieldPathsForType').mockImplementation(() => {
      throw new Error('path table broken');
    });
    await expect(open({ key })).rejects.toThrow('Failed to load datastores: Request (path table broken)');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(readFile('Request')).toBe(before);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('leaves no half-loaded datastores behind, so a later use fails at once instead of hanging', async () => {
    corrupt('Request');
    const db = createNedbDatabase();
    await expect(db.init({ dbPath: dir, fieldEncryptionKey: key })).rejects.toThrow('Failed to load datastores');
    await expect(db.count('Settings')).rejects.toThrow();
    await expect(db.insert(request() as never)).rejects.toThrow();
  });

  it('fails init() when the encrypted path table cannot be derived', async () => {
    vi.spyOn(models, 'getEncryptedFieldPathsByType').mockImplementation(() => {
      throw new Error('broken schema');
    });
    await expect(open({ key })).rejects.toThrow(/broken schema/);
    // without a key nothing is derived
    await expect(open()).resolves.toBeDefined();
  });
});
