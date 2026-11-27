import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readRawDocs } from "./db";

/** The plaintext database a pre-encryption version left behind, shared with the smoke tests. */
export const LEGACY_DB = path.resolve(
  import.meta.dirname,
  "../../insomnia-smoke-test/fixtures/insomnia-legacy-db",
);
/** The workspace inside `LEGACY_DB`, to parent seeded requests to. */
export const LEGACY_WORKSPACE_ID = "wrk_1b49626a0a9442b7b9474a1f3493bb5d";

const ENCRYPTED_PREFIX = "enc:insomnia:v1:";
// iv (12 bytes) + tag (16 bytes) + ciphertext. The tag length is fixed, so a shortened tag cannot pass as valid.
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

/** `<dataPath>/localStorage/fieldEncryptionKey` — where the app keeps its protected local key. */
export const keyFilePath = (dataPath: string): string =>
  path.join(dataPath, "localStorage", "fieldEncryptionKey");

/** Copies the plaintext legacy database into `dataPath`, before the app starts. */
export function copyLegacyDatabase(dataPath: string): void {
  fs.cpSync(LEGACY_DB, dataPath, { recursive: true });
}

/** Appends one document to a model's `.db` file, as an earlier app version would have written it. */
export function appendRawDoc(dataPath: string, type: string, doc: Record<string, unknown>): void {
  fs.appendFileSync(
    path.join(dataPath, `insomnia.${type}.db`),
    `${JSON.stringify({ type, ...doc })}\n`,
  );
}

/**
 * A value in the app's stored format that the app's own key cannot open,
 * because a different, random key made it — what a database restored
 * without its key file looks like.
 */
export function encryptWithAnotherKey(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createSecretKey(randomBytes(32)), iv);
  const body = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return ENCRYPTED_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/**
 * Writes a key file the OS cannot decrypt (the shape safeStorage produced on
 * another machine), so the app starts in degraded mode: no key, no
 * encryption, nothing deleted.
 */
export function writeUnusableKeyFile(dataPath: string): void {
  const file = keyFilePath(dataPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ version: 1, ciphertext: randomBytes(64).toString("base64") }),
  );
}

/** Decrypts a stored `enc:insomnia:v1:` value with a raw 32-byte key. Throws when the key is wrong. */
export function decryptStoredValue(keyBytes: Buffer, value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) throw new Error("Not an encrypted value");
  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", createSecretKey(keyBytes), payload.subarray(0, GCM_IV_LENGTH), {
    authTagLength: GCM_TAG_LENGTH,
  });
  decipher.setAuthTag(payload.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH));
  return Buffer.concat([decipher.update(payload.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH)), decipher.final()]).toString("utf8");
}

/** The raw key bytes of a JWK (`{"kty":"oct","k":...}`) as copied or exported from Preferences. */
export function keyBytesFromJwk(jwkText: string): Buffer {
  const jwk = JSON.parse(jwkText);
  if (jwk.kty !== "oct") throw new Error(`Unexpected key type: ${jwk.kty}`);
  return Buffer.from(jwk.k, "base64url");
}

/** Copies an app data directory's `.db` files (not its protected key) to a new temporary directory. */
export function copyDataDir(source: string): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-data-copy-"));
  for (const file of fs.readdirSync(source)) {
    if (/^insomnia\..+\.db$/.test(file)) fs.copyFileSync(path.join(source, file), path.join(destination, file));
  }
  return destination;
}

/**
 * What a directory of `.db` files holds, independent of how the files are laid out: each file's documents as they
 * stand (a later line of the same `_id` replaces the earlier one). Two snapshots are equal when nothing was changed.
 */
export function snapshotDataDir(directory: string): Record<string, unknown[]> {
  const snapshot: Record<string, unknown[]> = {};
  for (const file of fs.readdirSync(directory).sort()) {
    const match = /^insomnia\.(.+)\.db$/.exec(file);
    if (match) snapshot[match[1]] = readRawDocs(directory, match[1]).sort((a, b) => String(a._id).localeCompare(String(b._id)));
  }
  return snapshot;
}

/** A random 256-bit key in the JWK form that Export Key writes: a key from some other installation. */
export function randomJwkKey(): string {
  return JSON.stringify({ kty: "oct", k: randomBytes(32).toString("base64url"), alg: "A256GCM", ext: true });
}
