import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** The plaintext database a pre-encryption version left behind, shared with the smoke tests. */
export const LEGACY_DB = path.resolve(
  import.meta.dirname,
  "../../insomnia-smoke-test/fixtures/insomnia-legacy-db",
);
/** The workspace inside `LEGACY_DB`, to parent seeded requests to. */
export const LEGACY_WORKSPACE_ID = "wrk_1b49626a0a9442b7b9474a1f3493bb5d";

const ENCRYPTED_PREFIX = "enc:insomnia:v1:";

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
  const decipher = createDecipheriv("aes-256-gcm", createSecretKey(keyBytes), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

/** The raw key bytes of a JWK (`{"kty":"oct","k":...}`) as copied or exported from Preferences. */
export function keyBytesFromJwk(jwkText: string): Buffer {
  const jwk = JSON.parse(jwkText);
  if (jwk.kty !== "oct") throw new Error(`Unexpected key type: ${jwk.kty}`);
  return Buffer.from(jwk.k, "base64url");
}
