import { generateKeySync } from 'node:crypto';

import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { createFieldDecryptionFailureReport, createFieldEncryptionHooks } from './hooks';
import { forEachEncryptedLeaf } from './paths';
import { ENCRYPTED_VALUE_PREFIX, encryptValue } from './value';

// The hook rules (wrong key, tampering, lookalikes, ...) exercised against the real encrypted field paths of every model

const key = generateKeySync('aes', { length: 256 });
const otherKey = generateKeySync('aes', { length: 256 });

const setup = (hookKey = key) => {
  const failureReport = createFieldDecryptionFailureReport();
  const hooks = createFieldEncryptionHooks(hookKey, {
    getEncryptedFieldPaths: models.getEncryptedFieldPathsForType,
    failureReport,
  });
  return { ...hooks, failureReport };
};

const setPath = (
  node: Record<string, any>,
  segments: string[],
  index: number,
  parentPath: string,
  value: (path: string) => unknown,
) => {
  const segment = segments[index];
  const isArray = segment.endsWith('[]');
  const name = isArray ? segment.slice(0, -2) : segment;
  const path = parentPath ? `${parentPath}.${name}` : name;
  const isLast = index === segments.length - 1;
  if (!isArray) {
    if (isLast) {
      node[name] = value(path);
    } else {
      node[name] ??= {};
      setPath(node[name], segments, index + 1, path, value);
    }
    return;
  }
  node[name] ??= [{}, {}];
  node[name].forEach((_: unknown, i: number) => {
    const elementPath = `${path}[${i}]`;
    if (isLast) {
      node[name][i] = value(elementPath);
    } else {
      setPath(node[name][i], segments, index + 1, elementPath, value);
    }
  });
};

/** A document of `type` with a value on every encrypted path (arrays get two elements). */
const buildDoc = (type: string, value: (path: string) => unknown, extra: Record<string, unknown> = {}) => {
  const doc: Record<string, any> = { _id: `${type}_1`, type, name: 'a name', ...extra };
  for (const path of models.getEncryptedFieldPathsForType(type)) {
    setPath(doc, path.split('.'), 0, '', value);
  }
  return doc;
};

const concretePaths = (doc: unknown, type: string) => {
  const paths: string[] = [];
  forEachEncryptedLeaf(doc, models.getEncryptedFieldPathsForType(type), ({ path }) => paths.push(path));
  return paths.sort();
};

const leaves = (doc: unknown, type: string) => {
  const values: Record<string, unknown> = {};
  forEachEncryptedLeaf(doc, models.getEncryptedFieldPathsForType(type), ({ container, key: field, path }) => {
    values[path] = container[field];
  });
  return values;
};

const encryptedTypes = Object.entries(models.getEncryptedFieldPathsByType())
  .filter(([, paths]) => paths.length > 0)
  .map(([type]) => type);

const line = (doc: unknown) => JSON.stringify(doc);
const parse = (serialized: string) => JSON.parse(serialized);

describe('encrypted models', () => {
  it('covers the models that hold secrets', () => {
    expect(encryptedTypes).toEqual(
      expect.arrayContaining([
        'Request',
        'RequestGroup',
        'WebSocketRequest',
        'SocketIORequest',
        'McpRequest',
        'GrpcRequest',
        'CookieJar',
        'ClientCertificate',
        'CloudCredential',
        'GitCredentials',
        'OAuth2Token',
        'RequestVersion',
      ]),
    );
  });

  describe.each(encryptedTypes)('%s', type => {
    const plaintext = (path: string) => `secret-${path}`;

    it('encrypts every path and reads it back, leaving the rest of the document alone', () => {
      const { afterSerialization, beforeDeserialization, failureReport } = setup();
      const doc = buildDoc(type, plaintext, { description: 'not secret' });
      expect(concretePaths(doc, type).length).toBeGreaterThan(0);
      const written = afterSerialization(line(doc));
      for (const value of Object.values(leaves(parse(written), type))) {
        expect(String(value).startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
      }
      for (const path of concretePaths(doc, type)) {
        expect(written).not.toContain(plaintext(path));
      }
      expect(parse(written)).toMatchObject({ _id: doc._id, type, name: 'a name', description: 'not secret' });
      expect(parse(beforeDeserialization(written))).toEqual(doc);
      expect(failureReport.list()).toEqual([]);
    });

    it('writes null, empty and non-string values on encrypted paths unchanged, without throwing', () => {
      const { afterSerialization, beforeDeserialization, failureReport } = setup();
      for (const value of [null, '', 0, 7, true, { a: 1 }, ['x']]) {
        const doc = buildDoc(type, () => value);
        expect(parse(afterSerialization(line(doc)))).toEqual(doc);
        expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
      }
      expect(failureReport.list()).toEqual([]);
    });

    it('wrong key: keeps every value, loads the document, and reports exactly the affected fields', () => {
      const doc = buildDoc(type, plaintext);
      const written = setup(otherKey).afterSerialization(line(doc));
      const { beforeDeserialization, afterSerialization, failureReport } = setup();
      const loaded = beforeDeserialization(written);
      expect(parse(loaded)).toEqual(parse(written));
      expect(failureReport.list()).toEqual(concretePaths(doc, type).map(path => ({ type, _id: doc._id, path })));
      // byte for byte across a rewrite, and recoverable with the right key
      expect(parse(afterSerialization(loaded))).toEqual(parse(written));
      expect(parse(setup(otherKey).beforeDeserialization(afterSerialization(loaded)))).toEqual(doc);
    });

    it('tampered ciphertext: keeps the value and reports it', () => {
      const doc = buildDoc(type, plaintext);
      const written = parse(setup().afterSerialization(line(doc)));
      forEachEncryptedLeaf(written, models.getEncryptedFieldPathsForType(type), ({ container, key: field }) => {
        const payload = Buffer.from(String(container[field]).slice(ENCRYPTED_VALUE_PREFIX.length), 'base64');
        payload[payload.length - 1] ^= 0x01;
        container[field] = ENCRYPTED_VALUE_PREFIX + payload.toString('base64');
      });
      const { beforeDeserialization, failureReport } = setup();
      expect(parse(beforeDeserialization(line(written)))).toEqual(written);
      expect(failureReport.list().map(({ path }) => path)).toEqual(concretePaths(doc, type));
    });

    it.each([
      ['truncated below the minimum length', `${ENCRYPTED_VALUE_PREFIX}${Buffer.alloc(27, 1).toString('base64')}`],
      ['not base64', `${ENCRYPTED_VALUE_PREFIX}***not base64***`],
      ['wrong padding', `${ENCRYPTED_VALUE_PREFIX}${Buffer.alloc(40, 1).toString('base64').slice(0, -1)}`],
    ])(
      'malformed lookalike (%s) on an encrypted path: kept as is, not reported, written back unchanged',
      (_name, value) => {
        const { beforeDeserialization, afterSerialization, failureReport } = setup();
        const doc = buildDoc(type, () => value);
        expect(parse(beforeDeserialization(line(doc)))).toEqual(doc);
        expect(parse(afterSerialization(line(doc)))).toEqual(doc);
        expect(failureReport.list()).toEqual([]);
      },
    );

    it('ciphertext on a path that is not encrypted: never decrypted, never reported', () => {
      const { beforeDeserialization, afterSerialization, failureReport } = setup();
      const valid = encryptValue(key, 'would decrypt fine on an encrypted path');
      const invalid = encryptValue(otherKey, 'would fail on an encrypted path');
      const doc = buildDoc(type, plaintext, {
        name: valid,
        description: invalid,
        url: valid,
        headers: [{ name: 'X-A', value: valid }],
        body: { text: invalid },
        metadata: [{ name: 'a', value: valid }],
      });
      const written = afterSerialization(line(doc));
      const loaded = parse(beforeDeserialization(written));
      for (const field of ['name', 'description', 'url', 'headers', 'body', 'metadata']) {
        expect(loaded[field]).toEqual(doc[field]);
        expect(parse(written)[field]).toEqual(doc[field]);
      }
      expect(failureReport.list()).toEqual([]);
    });

    it('does not change the document count of a load + rewrite, and lets a corrupt line through', () => {
      const { beforeDeserialization, afterSerialization } = setup();
      const lines = [
        line(buildDoc(type, plaintext, { _id: `${type}_a` })),
        setup(otherKey).afterSerialization(line(buildDoc(type, plaintext, { _id: `${type}_b` }))),
        'corrupt line',
      ];
      const loaded = lines.map(beforeDeserialization);
      expect(loaded[2]).toBe('corrupt line');
      const rewritten = loaded.slice(0, 2).map(afterSerialization);
      expect(rewritten).toHaveLength(2);
      expect(parse(rewritten[1])).toEqual(parse(lines[1]));
    });
  });
});
