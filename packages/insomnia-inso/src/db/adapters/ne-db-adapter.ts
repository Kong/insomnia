import { stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';

import NeDB from '@seald-io/nedb';
import { models } from 'insomnia-data';
import {
  countWellFormedCiphertext,
  createFieldDecryptionFailureReport,
  createFieldEncryptionHooks,
  getFieldEncryptionKeyHost,
  getHooksForType,
  isSameHost,
  parseFieldEncryptionKey,
  reconcileFieldDecryptionFailures,
} from 'insomnia-data/node';

import { InsoError } from '../../errors';
import { logger } from '../../logger';
import type { BaseModel } from '../models/types';
import type { Database, DbAdapter } from '../types';
import { emptyDb } from '../types';

const MAX_LISTED_FIELDS = 10;
const MAX_HOST_LENGTH = 255;

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

/**
 * The key records the machine it was exported on. Used on another machine, it would encrypt that machine's plaintext
 * values with a key its Insomnia does not have, so the user is warned and may go on.
 */
const warnIfKeyIsFromAnotherMachine = (encryptionKey: string) => {
  const keyHost = getFieldEncryptionKeyHost(encryptionKey);
  if (keyHost && !isSameHost(keyHost, hostname())) {
    // The name comes from the key text: quoted as JSON (so control characters are escaped) and cut to a host name's length
    logger.warn(
      `The encryption key was exported on ${JSON.stringify(keyHost.slice(0, MAX_HOST_LENGTH))}, but this machine is ${JSON.stringify(hostname())}. ` +
        'inso encrypts the plaintext values it finds in the data directory with this key, and the Insomnia on this ' +
        'machine cannot read values that were encrypted with the key of another machine. Use the key from the Insomnia ' +
        'on this machine, unless you know that this key belongs to this data directory.',
    );
  }
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
  if (encryptionKey) {
    // Before the load below: the load already rewrites the files, so a warning after it would come too late
    warnIfKeyIsFromAnotherMachine(encryptionKey);
  }
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
          // Only the datastores that have encrypted fields need the hooks
          ...getHooksForType(hooks, t, models.getEncryptedFieldPathsForType),
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
