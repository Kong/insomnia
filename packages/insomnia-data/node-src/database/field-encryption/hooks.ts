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

/** Identifies a failure: the same field of the same document is one entry, however often it was read. */
const getFailureKey = ({ type, _id, path }: FieldDecryptionFailure) => JSON.stringify([type, _id, path]);

/** In-memory failure report owned by one database instance. */
export interface FieldDecryptionFailureReport {
  add: (failure: FieldDecryptionFailure) => void;
  list: () => FieldDecryptionFailure[];
  /** Keeps only the entries for which `keep` returns true. */
  retain: (keep: (failure: FieldDecryptionFailure) => boolean) => void;
}

export const createFieldDecryptionFailureReport = (): FieldDecryptionFailureReport => {
  const failures = new Map<string, FieldDecryptionFailure>();
  return {
    add: failure => {
      failures.set(getFailureKey(failure), failure);
    },
    list: () => [...failures.values()],
    retain: keep => {
      for (const [key, failure] of failures) {
        if (!keep(failure)) {
          failures.delete(key);
        }
      }
    },
  };
};

/**
 * Drops the entries that do not describe the loaded data any more.
 *
 * The read hook reports a failure for every line it reads, but a `.db` file holds several lines per document: an update
 * appends a new line, and a removal appends a deletion marker, while the old lines stay until the next rewrite. A failure
 * on a line that a later line replaced or deleted must not reach the user. So once a load has finished, an entry is kept
 * only if the document still exists and still holds well-formed ciphertext at that path.
 *
 * `findDocument` reads the loaded in-memory state, so it must only be called for datastores whose load has finished. It is
 * called once per document, however many of its fields failed. It resolves `null` when the document does not exist, and
 * `undefined` when it cannot be looked up at all (no datastore for the type): that entry is kept, so the failure stays visible.
 */
export const reconcileFieldDecryptionFailures = async (
  report: FieldDecryptionFailureReport,
  getEncryptedFieldPaths: (type: string) => readonly string[],
  findDocument: (type: string, _id: string) => Promise<unknown>,
) => {
  const failuresByDocument = new Map<string, FieldDecryptionFailure[]>();
  for (const failure of report.list()) {
    const documentKey = JSON.stringify([failure.type, failure._id]);
    failuresByDocument.set(documentKey, [...(failuresByDocument.get(documentKey) ?? []), failure]);
  }

  const keep = new Set<string>();
  for (const failures of failuresByDocument.values()) {
    const { type, _id } = failures[0];
    const doc = await findDocument(type, _id);
    if (doc === undefined) {
      failures.forEach(failure => keep.add(getFailureKey(failure)));
      continue;
    }
    const valueAtPath = new Map<string, unknown>();
    forEachEncryptedLeaf(doc, getEncryptedFieldPaths(type), ({ container, key, path }) => {
      valueAtPath.set(path, container[key]);
    });
    for (const failure of failures) {
      const value = valueAtPath.get(failure.path);
      if (typeof value === 'string' && isWellFormedCiphertext(value)) {
        keep.add(getFailureKey(failure));
      }
    }
  }
  report.retain(failure => keep.has(getFailureKey(failure)));
};

/**
 * How many fields of the document hold well-formed ciphertext on the given encrypted paths. For readers that have no key
 * and want to tell the user that some values cannot be read.
 */
export const countWellFormedCiphertext = (doc: unknown, paths: readonly string[]) => {
  let count = 0;
  forEachEncryptedLeaf(doc, paths, ({ container, key }) => {
    const value = container[key];
    if (typeof value === 'string' && isWellFormedCiphertext(value)) {
      count++;
    }
  });
  return count;
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
