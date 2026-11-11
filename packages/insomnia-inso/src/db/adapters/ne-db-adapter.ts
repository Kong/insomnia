import { stat } from 'node:fs/promises';
import path from 'node:path';

import NeDB from '@seald-io/nedb';
import { models } from 'insomnia-data';
import {
  countWellFormedCiphertext,
  createFieldDecryptionFailureReport,
  createFieldEncryptionHooks,
  parseFieldEncryptionKey,
  reconcileFieldDecryptionFailures,
} from 'insomnia-data/node';

import { InsoError } from '../../errors';
import { logger } from '../../logger';
import type { BaseModel } from '../models/types';
import type { Database, DbAdapter } from '../types';
import { emptyDb } from '../types';

const MAX_LISTED_FIELDS = 10;

const parseKey = (encryptionKey: string) => {
  try {
    return parseFieldEncryptionKey(encryptionKey);
  } catch (error) {
    // Without the cause: it is derived from the key
    throw new InsoError((error as Error).message);
  }
};

/** Names the fields, never their values: `Request authentication.password (2)`. */
const describeFields = (fields: { type: string; path: string }[]) => {
  const counts = new Map<string, number>();
  for (const { type, path } of fields) {
    // `cookies[3].value` and `cookies[7].value` are the same field of the model
    const label = `${type} ${path.replace(/\[\d+\]/g, '[]')}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const lines = [...counts].map(([label, count]) => `  - ${label}${count > 1 ? ` (${count})` : ''}`);
  return [...lines.slice(0, MAX_LISTED_FIELDS), ...(lines.length > MAX_LISTED_FIELDS ? ['  - ...'] : [])].join('\n');
};

const neDbAdapter: DbAdapter = async (dir, filterTypes, encryptionKey) => {
  // Confirm if db files exist
  try {
    await stat(path.join(dir, 'insomnia.Workspace.db'));
  } catch {
    return null;
  }

  // The key is only looked at when the data really comes from NeDB, so a key that is set for every command (for example
  // in the environment) does not get in the way of commands that read an export file or a git repository
  const key = encryptionKey ? parseKey(encryptionKey) : undefined;
  const failureReport = createFieldDecryptionFailureReport();
  const hooks = key
    ? createFieldEncryptionHooks(key, { getEncryptedFieldPaths: models.getEncryptedFieldPathsForType, failureReport })
    : {};

  const db = emptyDb();
  const types = filterTypes?.length ? filterTypes : (Object.keys(db) as (keyof Database)[]);
  // Loading a datastore makes NeDB rewrite its file. With the key, the rewrite also encrypts the plaintext values that
  // are still in the file, so a key must only be used on the machine it came from (the Insomnia preferences say so).
  const promises = types.map(
    t =>
      new Promise((resolve, reject) => {
        const filePath = path.join(dir, `insomnia.${t}.db`);
        const collection = new NeDB({
          autoload: true,
          filename: filePath,
          corruptAlertThreshold: 0.9,
          ...hooks,
        });
        collection.find({}, (err: Error, docs: BaseModel[]) => {
          if (err) {
            return reject(err);
          }

          (db[t] as {}[]).push(...docs);
          resolve(null);
        });
      }),
  );
  await Promise.all(promises);

  if (key) {
    // The read hook reports every line it cannot decrypt, including old lines that a later line replaced
    await reconcileFieldDecryptionFailures(
      failureReport,
      models.getEncryptedFieldPathsForType,
      async (type, _id) =>
        (db[type as keyof Database] as BaseModel[] | undefined)?.find(doc => doc._id === _id) ?? null,
    );
    const failures = failureReport.list();
    if (failures.length > 0) {
      // Sending the ciphertext in place of the value would only fail later and more confusingly
      throw new InsoError(
        `Could not decrypt ${failures.length} encrypted value(s) in "${dir}" with the given encryption key. ` +
          `It is the wrong key for this data, or the values are damaged. Affected fields:\n${describeFields(failures)}`,
      );
    }
  } else {
    const counts = new Map<string, number>();
    for (const type of types) {
      const paths = models.getEncryptedFieldPathsForType(type);
      const count = (db[type] as BaseModel[]).reduce((sum, doc) => sum + countWellFormedCiphertext(doc, paths), 0);
      if (count > 0) {
        counts.set(type, count);
      }
    }
    if (counts.size > 0) {
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const byType = [...counts].map(([type, count]) => `${type}: ${count}`).join(', ');
      logger.warn(
        `Found ${total} encrypted value(s) (${byType}) in "${dir}" and no encryption key, so they cannot be read: ` +
          'requests that use them will fail. Pass the key from the Insomnia preferences (General > Local Encryption Key > Copy Key) ' +
          'with the INSOMNIA_ENCRYPTION_KEY environment variable or the --encryption-key option.',
      );
    }
  }

  return db;
};

export default neDbAdapter;
