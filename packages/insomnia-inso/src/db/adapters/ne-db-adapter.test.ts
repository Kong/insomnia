import { generateKeySync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { models } from 'insomnia-data';
import {
  createFieldDecryptionFailureReport,
  createFieldEncryptionHooks,
  exportFieldEncryptionKey,
} from 'insomnia-data/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InsoError } from '../../errors';
import { logger } from '../../logger';
import neDbAdapter from './ne-db-adapter';

describe('neDbAdapter()', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');

  it('should return null if data directory is invalid', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await neDbAdapter(workingDir);
    expect(db).toBe(null);
  });

  describe('encrypted fields', () => {
    const secret = 'plaintext-bearer-token';
    const key = generateKeySync('aes', { length: 256 });
    const otherKey = generateKeySync('aes', { length: 256 });
    let dir: string;
    let warn: ReturnType<typeof vi.spyOn>;

    // Written the way the app writes a datastore: one JSON document per line, encrypted by the same hooks
    const writeDatastore = (
      type: string,
      docs: Record<string, unknown>[],
      { encryptWith = key, plaintext = false }: { encryptWith?: typeof key; plaintext?: boolean } = {},
    ) => {
      const { afterSerialization } = createFieldEncryptionHooks(encryptWith, {
        getEncryptedFieldPaths: models.getEncryptedFieldPathsForType,
        failureReport: createFieldDecryptionFailureReport(),
      });
      const lines = docs.map(doc => (plaintext ? JSON.stringify(doc) : afterSerialization(JSON.stringify(doc))));
      fs.writeFileSync(path.join(dir, `insomnia.${type}.db`), `${lines.join('\n')}\n`);
    };
    const request = (id: string, token = secret) => ({
      _id: id,
      type: 'Request',
      parentId: 'wrk_1',
      name: `Request ${id}`,
      authentication: { type: 'bearer', token },
    });
    const readDatastore = (type: string) => fs.readFileSync(path.join(dir, `insomnia.${type}.db`), 'utf8');
    const load = (encryptionKey?: string) => neDbAdapter(dir, ['Request'], encryptionKey);
    const tokenOf = (db: Awaited<ReturnType<typeof load>>, id: string) =>
      (db!.Request.find(doc => doc._id === id) as { authentication: { token: string } }).authentication.token;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inso-nedb-encrypted-'));
      fs.writeFileSync(path.join(dir, 'insomnia.Workspace.db'), '');
      warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      vi.restoreAllMocks();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    describe('with the key', () => {
      it.each([
        ['the base64 text from Copy Key', () => exportFieldEncryptionKey(key).base64],
        ['the JWK JSON from Export Key', () => exportFieldEncryptionKey(key).jwk],
      ])('decrypts the values, given %s', async (_, getText) => {
        writeDatastore('Request', [request('req_1')]);
        expect(readDatastore('Request')).not.toContain(secret);

        const db = await load(getText());

        expect(tokenOf(db, 'req_1')).toBe(secret);
        expect(warn).not.toHaveBeenCalled();
      });

      it('leaves plaintext values as they are, and says nothing, when the data holds no ciphertext', async () => {
        writeDatastore('Request', [request('req_1')], { plaintext: true });
        expect(readDatastore('Request')).toContain(secret);

        const db = await load(exportFieldEncryptionKey(key).base64);

        expect(tokenOf(db, 'req_1')).toBe(secret);
        expect(warn).not.toHaveBeenCalled();
      });

      it('reads a datastore that mixes plaintext and ciphertext', async () => {
        writeDatastore('Request', [request('req_1')]);
        fs.appendFileSync(
          path.join(dir, 'insomnia.Request.db'),
          `${JSON.stringify(request('req_2', 'still-plain'))}\n`,
        );

        const db = await load(exportFieldEncryptionKey(key).base64);

        expect(tokenOf(db, 'req_1')).toBe(secret);
        expect(tokenOf(db, 'req_2')).toBe('still-plain');
      });

      it('encrypts the plaintext values that are still in the files, as the app does when it opens them', async () => {
        writeDatastore('Request', [request('req_1')], { plaintext: true });
        expect(readDatastore('Request')).toContain(secret);

        const db = await load(exportFieldEncryptionKey(key).base64);

        expect(tokenOf(db, 'req_1')).toBe(secret);
        expect(readDatastore('Request')).not.toContain(secret);
        expect(readDatastore('Request')).toContain('enc:insomnia:v1:');
        // and the same key reads them back
        expect(tokenOf(await load(exportFieldEncryptionKey(key).jwk), 'req_1')).toBe(secret);
      });

      it('does not mind a key that is given when the data is not encrypted at all', async () => {
        writeDatastore('Request', [request('req_1')], { plaintext: true });
        await expect(load(exportFieldEncryptionKey(key).jwk)).resolves.toBeTruthy();
      });
    });

    describe('with a key that does not decrypt the values', () => {
      const wrongKey = () => exportFieldEncryptionKey(otherKey).base64;

      it('fails, and names the fields but shows neither the values nor the key', async () => {
        writeDatastore('Request', [request('req_1'), request('req_2')]);

        const error = await load(wrongKey()).catch(e => e);

        expect(error).toBeInstanceOf(InsoError);
        expect(error.message).toContain('Could not decrypt 2 encrypted value(s)');
        expect(error.message).toContain('Request authentication.token (2)');
        expect(error.message).not.toContain(secret);
        expect(error.message).not.toContain('enc:insomnia:v1:');
        expect(error.message).not.toContain(wrongKey());
        expect(error.cause).toBeUndefined();
      });

      it('does not damage the data: the ciphertext is still on disk, and the right key reads it', async () => {
        writeDatastore('Request', [request('req_1')]);
        const before = JSON.parse(readDatastore('Request').trim()).authentication.token;

        await expect(load(wrongKey())).rejects.toThrow('Could not decrypt');

        expect(JSON.parse(readDatastore('Request').trim()).authentication.token).toBe(before);
        expect(tokenOf(await load(exportFieldEncryptionKey(key).base64), 'req_1')).toBe(secret);
      });

      it('does not fail for a value that a later line of the file replaced', async () => {
        writeDatastore('Request', [request('req_1')], { encryptWith: otherKey });
        // The app appends a line for an update; the old line stays until the file is rewritten
        const { afterSerialization } = createFieldEncryptionHooks(key, {
          getEncryptedFieldPaths: models.getEncryptedFieldPathsForType,
          failureReport: createFieldDecryptionFailureReport(),
        });
        fs.appendFileSync(
          path.join(dir, 'insomnia.Request.db'),
          `${afterSerialization(JSON.stringify(request('req_1', 'updated')))}\n`,
        );

        const db = await load(exportFieldEncryptionKey(key).base64);

        expect(tokenOf(db, 'req_1')).toBe('updated');
      });
    });

    describe('with a key that is not valid', () => {
      it.each([
        ['text that is neither form', 'definitely-not-a-key'],
        ['a JWK of the wrong size', JSON.stringify({ kty: 'oct', k: 'c2hvcnQ' })],
      ])('fails with a message that does not repeat the key: %s', async (_, text) => {
        writeDatastore('Request', [request('req_1')]);

        const error = await load(text).catch(e => e);

        expect(error).toBeInstanceOf(InsoError);
        expect(error.message).toContain('Invalid encryption key');
        expect(error.message).not.toContain(text);
        expect(error.cause).toBeUndefined();
      });

      it('is only looked at when the data comes from NeDB', async () => {
        // No datastore here at all: the adapter answers null before it would look at the key
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'inso-nedb-none-'));
        try {
          await expect(neDbAdapter(empty, ['Request'], 'definitely-not-a-key')).resolves.toBeNull();
        } finally {
          fs.rmSync(empty, { recursive: true, force: true });
        }
      });
    });

    describe('without a key', () => {
      it('warns once, with the counts and how to pass the key, and carries on with the values untouched', async () => {
        writeDatastore('Request', [request('req_1'), request('req_2')]);

        const db = await load();

        expect(db).toBeTruthy();
        expect(tokenOf(db, 'req_1')).toMatch(/^enc:insomnia:v1:/);
        expect(warn).toHaveBeenCalledTimes(1);
        const message = String(warn.mock.calls[0][0]);
        expect(message).toContain('Found 2 encrypted value(s) (Request: 2)');
        expect(message).toContain('--encryption-key');
        expect(message).toContain('INSOMNIA_ENCRYPTION_KEY');
        expect(message).not.toContain(secret);
        expect(message).not.toContain('enc:insomnia:v1:');
      });

      it('treats an empty key as no key', async () => {
        writeDatastore('Request', [request('req_1')]);
        await load('');
        expect(warn).toHaveBeenCalledTimes(1);
      });

      it('says nothing when there is no ciphertext', async () => {
        writeDatastore('Request', [request('req_1')], { plaintext: true });
        const db = await load();
        expect(tokenOf(db, 'req_1')).toBe(secret);
        expect(warn).not.toHaveBeenCalled();
      });

      it('only counts the types that were asked for', async () => {
        writeDatastore('Request', [request('req_1')]);
        const db = await neDbAdapter(dir, ['Workspace']);
        expect(db).toBeTruthy();
        expect(warn).not.toHaveBeenCalled();
      });

      it('does not change what is on disk', async () => {
        writeDatastore('Request', [request('req_1')]);
        const before = JSON.parse(readDatastore('Request').trim()).authentication.token;
        await load();
        expect(JSON.parse(readDatastore('Request').trim()).authentication.token).toBe(before);
      });
    });
  });
});
