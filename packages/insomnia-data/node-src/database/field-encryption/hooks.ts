import { forEachEncryptedLeaf } from './paths';
import {
  assertFieldEncryptionKey,
  decryptValue,
  encryptValue,
  type FieldEncryptionKey,
  hasEncryptedValuePrefix,
  isWellFormedCiphertext,
} from './value';

export interface FieldDecryptionFailure {
  type: string;
  _id: string;
  /** Concrete path inside the document, e.g. `authentication.password` or `cookies[2].value`. */
  path: string;
}

/** In-memory failure report owned by one database instance. */
export interface FieldDecryptionFailureReport {
  add: (failure: FieldDecryptionFailure) => void;
  list: () => FieldDecryptionFailure[];
}

export const createFieldDecryptionFailureReport = (): FieldDecryptionFailureReport => {
  const failures = new Map<string, FieldDecryptionFailure>();
  return {
    add: failure => {
      failures.set(JSON.stringify([failure.type, failure._id, failure.path]), failure);
    },
    list: () => [...failures.values()],
  };
};

export interface FieldEncryptionHooksOptions {
  /** Encrypted field paths of a document type; empty for types without encrypted fields. */
  getEncryptedFieldPaths: (type: string) => readonly string[];
  failureReport: FieldDecryptionFailureReport;
}

export interface FieldEncryptionHooks {
  afterSerialization: (line: string) => string;
  beforeDeserialization: (line: string) => string;
  testSerializationHooks: false;
}

const getDocType = (doc: unknown) => {
  const type = (doc as { type?: unknown } | null)?.type;
  return typeof type === 'string' ? type : undefined;
};

export const createFieldEncryptionHooks = (
  key: FieldEncryptionKey,
  { getEncryptedFieldPaths, failureReport }: FieldEncryptionHooksOptions,
): FieldEncryptionHooks => {
  assertFieldEncryptionKey(key);

  const afterSerialization = (line: string) => {
    // Not wrapped in try/catch on purpose: a failure here is a bug in our code and must not fall back to plaintext
    const doc = JSON.parse(line);
    const type = getDocType(doc);
    const paths = type === undefined ? [] : getEncryptedFieldPaths(type);
    forEachEncryptedLeaf(doc, paths, ({ container, key: field, path }) => {
      const value = container[field];
      // Only non-empty strings are encrypted. Values that already carry the prefix are never encrypted again, so values
      // that failed decryption stay byte-identical across rewrites.
      if (typeof value !== 'string' || value === '' || hasEncryptedValuePrefix(value)) {
        return;
      }
      try {
        container[field] = encryptValue(key, value);
      } catch (error) {
        throw new Error(`Failed to encrypt field ${path} of a ${type} document`, { cause: error });
      }
    });
    return JSON.stringify(doc);
  };

  const beforeDeserialization = (line: string) => {
    let doc;
    try {
      doc = JSON.parse(line);
    } catch {
      // A genuinely corrupt line is not ours to handle: NeDB's own corrupt-line handling applies, exactly as without encryption
      return line;
    }
    try {
      const type = getDocType(doc);
      if (type === undefined) {
        return line;
      }
      forEachEncryptedLeaf(doc, getEncryptedFieldPaths(type), ({ container, key: field, path }) => {
        const value = container[field];
        // Only a value on an encrypted path that is well-formed ciphertext is decrypted. Anything else is plaintext: never decrypted, never reported
        if (typeof value !== 'string' || !isWellFormedCiphertext(value)) {
          return;
        }
        try {
          container[field] = decryptValue(key, value);
        } catch {
          failureReport.add({ type, _id: String(doc._id), path });
        }
      });
      return JSON.stringify(doc);
    } catch (error) {
      // Must never throw: NeDB would count the line as corrupt, skip it, and the rewrite would delete the document.
      // Logs the error only, never the line, which may hold secrets.
      console.error('[db] Field decryption hook failed, line left unchanged:', error);
      return line;
    }
  };

  return { afterSerialization, beforeDeserialization, testSerializationHooks: false };
};
