import { generateKeySync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { models } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNedbDatabase } from './database-nedb';
import { forEachEncryptedLeaf } from './field-encryption/paths';
import { ENCRYPTED_VALUE_PREFIX } from './field-encryption/value';

// Migrating a real plaintext database: the legacy fixture of the smoke tests, plus a document with a secret on every
// encrypted path of every model (the fixture holds almost no secrets). There is no migration step to test, only the
// first load with the key, so these tests run that load on real NeDB files and look at what ends up on disk.

const fixtureDir = path.resolve(__dirname, '..', '..', '..', 'insomnia-smoke-test', 'fixtures', 'insomnia-legacy-db');
const key = generateKeySync('aes', { length: 256 });

const encryptedPathsByType = Object.fromEntries(
  Object.entries(models.getEncryptedFieldPathsByType()).filter(([, paths]) => paths.length > 0),
);
const secretOf = (type: string, fieldPath: string) => `secret-value:${type}:${fieldPath}`;

/** Sets `value` on every concrete location of `segments` (arrays get two elements). */
const assignPath = (
  node: Record<string, any>,
  segments: string[],
  parentPath: string,
  value: (path: string) => string,
): void => {
  const [segment, ...rest] = segments;
  const isArray = segment.endsWith('[]');
  const name = isArray ? segment.slice(0, -2) : segment;
  const fieldPath = parentPath ? `${parentPath}.${name}` : name;
  if (!isArray) {
    if (rest.length === 0) {
      node[name] = value(fieldPath);
    } else {
      node[name] ??= {};
      assignPath(node[name], rest, fieldPath, value);
    }
    return;
  }
  node[name] ??= [{}, {}];
  node[name].forEach((_: unknown, index: number) => {
    const elementPath = `${fieldPath}[${index}]`;
    if (rest.length === 0) {
      node[name][index] = value(elementPath);
    } else {
      assignPath(node[name][index], rest, elementPath, value);
    }
  });
};

const dataFile = (dir: string, type: string) => path.join(dir, `insomnia.${type}.db`);
const typesIn = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter(file => /^insomnia\..+\.db$/.test(file))
    .map(file => file.slice('insomnia.'.length, -'.db'.length));

/** The documents a file holds: the last line of an id wins, a deletion marker removes it. */
const readDocs = (dir: string, type: string) => {
  const docs = new Map<string, Record<string, any>>();
  for (const line of fs.readFileSync(dataFile(dir, type), 'utf8').split('\n')) {
    if (line === '') {
      continue;
    }
    const doc = JSON.parse(line);
    if (doc.$$indexCreated) {
      continue;
    }
    if (doc.$$deleted) {
      docs.delete(doc._id);
    } else {
      docs.set(doc._id, doc);
    }
  }
  return docs;
};

const encryptedLeaves = (doc: unknown, type: string) => {
  const leaves: { path: string; value: unknown }[] = [];
  forEachEncryptedLeaf(doc, encryptedPathsByType[type] ?? [], ({ container, key: field, path: leafPath }) =>
    leaves.push({ path: leafPath, value: container[field] }),
  );
  return leaves;
};
/** Leaves that hold a secret, so the ones that must be ciphertext on disk: empty values are written as they are. */
const secretLeaves = (doc: unknown, type: string) =>
  encryptedLeaves(doc, type).filter(leaf => typeof leaf.value === 'string' && leaf.value !== '');

/** The document with every encrypted leaf blanked, which is everything that must not change during the migration. */
const withoutEncryptedLeaves = (doc: Record<string, any>, type: string) => {
  const copy = structuredClone(doc);
  forEachEncryptedLeaf(copy, encryptedPathsByType[type] ?? [], ({ container, key: field }) => {
    container[field] = null;
  });
  return copy;
};

const open = async (dbPath: string, options: { encrypt?: boolean } = { encrypt: true }) => {
  let internals!: { getFieldDecryptionFailures: () => unknown[] };
  const db = createNedbDatabase((nedbDatabase, nedbInternals) => {
    internals = nedbInternals;
    return nedbDatabase;
  });
  await db.init({ dbPath, fieldEncryptionKey: options.encrypt ? key : undefined });
  return { db, failures: () => internals.getFieldDecryptionFailures() };
};

// Loading also gives random ids to nested items that have none (such as environment key-value pairs)
const generatedId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const withoutGeneratedIds = (value: unknown) =>
  JSON.parse(JSON.stringify(value), (field, item) =>
    field === 'id' && typeof item === 'string' && generatedId.test(item) ? '<generated id>' : item,
  );

/** Every document of every datastore, as the app sees it. */
const viewOf = async (db: Awaited<ReturnType<typeof open>>['db'], types: string[]) => {
  const view: Record<string, unknown[]> = {};
  for (const type of types) {
    const docs = await db.find<any>(type as never, {} as never);
    view[type] = withoutGeneratedIds(docs.sort((a, b) => a._id.localeCompare(b._id)));
  }
  return view;
};

let root: string;
let plainDir: string;
let types: string[];

const copyOfPlain = (name: string) => {
  const target = path.join(root, name);
  fs.cpSync(plainDir, target, { recursive: true });
  return target;
};

beforeEach(() => {
  // Loading fills in timestamps that are missing from old documents, so a fixed clock makes two loads comparable
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-field-encryption-migration-'));
  plainDir = path.join(root, 'plain');
  fs.cpSync(fixtureDir, plainDir, { recursive: true });
  for (const [type, paths] of Object.entries(encryptedPathsByType)) {
    const doc: Record<string, any> = { _id: `${type}_seeded`, type, parentId: 'wrk_seeded', name: 'seeded' };
    for (const fieldPath of paths) {
      assignPath(doc, fieldPath.split('.'), '', leafPath => secretOf(type, leafPath));
    }
    fs.appendFileSync(dataFile(plainDir, type), `${JSON.stringify(doc)}\n`);
  }
  types = typesIn(plainDir);
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the fixture and the seeded secrets', () => {
  it('are plaintext, cover every model with encrypted fields, and include the secrets the fixture has itself', () => {
    expect(Object.keys(encryptedPathsByType).length).toBeGreaterThan(5);
    for (const type of Object.keys(encryptedPathsByType)) {
      const seeded = readDocs(plainDir, type).get(`${type}_seeded`);
      expect(secretLeaves(seeded, type).length, `${type} has a seeded secret`).toBeGreaterThan(0);
    }
    const fromFixture = [...readDocs(plainDir, 'RequestVersion').values()].filter(
      doc => doc._id !== 'RequestVersion_seeded',
    );
    expect(fromFixture.length).toBeGreaterThan(0);
    for (const doc of fromFixture) {
      expect(secretLeaves(doc, 'RequestVersion').length).toBeGreaterThan(0);
      expect(String(doc.compressedRequest).startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(false);
    }
  });
});

describe('the first launch with the key', () => {
  it('encrypts every sensitive field of every datastore', async () => {
    const migrated = copyOfPlain('migrating');
    await open(migrated);

    let encrypted = 0;
    for (const type of types) {
      for (const [id, original] of readDocs(plainDir, type)) {
        const onDisk = readDocs(migrated, type).get(id);
        const expectedLeaves = secretLeaves(original, type);
        for (const leaf of expectedLeaves) {
          const written = encryptedLeaves(onDisk, type).find(candidate => candidate.path === leaf.path)?.value;
          expect(String(written).startsWith(ENCRYPTED_VALUE_PREFIX), `${type} ${id} ${leaf.path}`).toBe(true);
          encrypted++;
        }
      }
      const raw = fs.readFileSync(dataFile(migrated, type), 'utf8');
      for (const original of readDocs(plainDir, type).values()) {
        for (const leaf of secretLeaves(original, type)) {
          expect(raw, `${type} ${leaf.path} in plaintext`).not.toContain(String(leaf.value));
        }
      }
    }
    expect(encrypted).toBeGreaterThan(Object.keys(encryptedPathsByType).length);
  });

  it('keeps every document and every field that is not sensitive', async () => {
    const migrated = copyOfPlain('migrating');
    await open(migrated);

    for (const type of types) {
      const before = readDocs(plainDir, type);
      const after = readDocs(migrated, type);
      expect([...after.keys()].sort(), `${type} documents`).toEqual([...before.keys()].sort());
      for (const [id, doc] of before) {
        expect(withoutEncryptedLeaves(after.get(id)!, type), `${type} ${id}`).toEqual(
          withoutEncryptedLeaves(doc, type),
        );
      }
    }
  });

  it('reads back exactly the data that a launch without encryption reads, now and on the next launch', async () => {
    const expected = await viewOf((await open(copyOfPlain('baseline'), { encrypt: false })).db, types);
    const migrated = copyOfPlain('migrating');

    const first = await open(migrated);
    expect(await viewOf(first.db, types)).toEqual(expected);
    expect(first.failures()).toEqual([]);

    const second = await open(migrated);
    expect(await viewOf(second.db, types)).toEqual(expected);
    expect(second.failures()).toEqual([]);
  });
});

describe('a launch that was interrupted', () => {
  const originalView = async () => viewOf((await open(copyOfPlain('baseline'), { encrypt: false })).db, types);

  /** Every secret of the plaintext copy is ciphertext on disk, so the migration is finished. */
  const expectMigrated = (dir: string) => {
    for (const type of types) {
      for (const [id, original] of readDocs(plainDir, type)) {
        const onDisk = readDocs(dir, type).get(id);
        for (const leaf of secretLeaves(original, type)) {
          const written = encryptedLeaves(onDisk, type).find(candidate => candidate.path === leaf.path)?.value;
          expect(String(written).startsWith(ENCRYPTED_VALUE_PREFIX), `${type} ${id} ${leaf.path}`).toBe(true);
        }
      }
    }
  };

  it('leaves datastores that are partly encrypted and partly plaintext, which read correctly and are finished by the next launch', async () => {
    const expected = await originalView();
    const migrated = copyOfPlain('migrating');
    await open(migrated);
    // Killed before every second datastore was rewritten: those still hold the original plaintext
    types
      .filter((_, index) => index % 2 === 0)
      .forEach(type => fs.copyFileSync(dataFile(plainDir, type), dataFile(migrated, type)));
    const mixed = types.filter(
      type => !fs.readFileSync(dataFile(migrated, type), 'utf8').includes(ENCRYPTED_VALUE_PREFIX),
    );
    expect(mixed.length).toBeGreaterThan(0);
    expect(mixed.length).toBeLessThan(types.length);

    const { db, failures } = await open(migrated);

    expect(await viewOf(db, types)).toEqual(expected);
    expect(failures()).toEqual([]);
    expectMigrated(migrated);
  });

  it('can leave a half-written temporary file next to the plaintext datastore, which the next launch ignores and replaces', async () => {
    const expected = await originalView();
    const encryptedCopy = copyOfPlain('encrypted');
    await open(encryptedCopy);
    const migrated = copyOfPlain('migrating');
    for (const type of ['Request', 'RequestVersion', 'CookieJar']) {
      const complete = fs.readFileSync(dataFile(encryptedCopy, type), 'utf8');
      fs.writeFileSync(`${dataFile(migrated, type)}~`, complete.slice(0, Math.floor(complete.length / 2)));
    }

    const { db, failures } = await open(migrated);

    expect(await viewOf(db, types)).toEqual(expected);
    expect(failures()).toEqual([]);
    expect(fs.readdirSync(migrated).filter(file => file.endsWith('~'))).toEqual([]);
    expectMigrated(migrated);
  });

  it.each(['plaintext', 'encrypted'])(
    'can leave only the %s temporary file and no datastore, which the next launch recovers',
    async content => {
      const expected = await originalView();
      const encryptedCopy = copyOfPlain('encrypted');
      await open(encryptedCopy);
      const migrated = copyOfPlain('migrating');
      for (const type of ['Request', 'RequestVersion', 'CookieJar']) {
        fs.rmSync(dataFile(migrated, type));
        fs.copyFileSync(
          dataFile(content === 'plaintext' ? plainDir : encryptedCopy, type),
          `${dataFile(migrated, type)}~`,
        );
      }

      const { db, failures } = await open(migrated);

      expect(await viewOf(db, types)).toEqual(expected);
      expect(failures()).toEqual([]);
      expect(fs.readdirSync(migrated).filter(file => file.endsWith('~'))).toEqual([]);
      expectMigrated(migrated);
    },
  );
});
