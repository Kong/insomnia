# NeDB Local Database Field-Level Encryption Design

## 1. Background & Goals

Insomnia uses NeDB as its local embedded database, storing users' API requests, authentication credentials, and other data. This data is saved as plaintext JSON in `.db` files, posing a risk of sensitive information exposure (e.g., auth tokens, passwords, certificate private keys). This was flagged as a security risk in a recent penetration test ([INS-2368](https://konghq.atlassian.net/browse/INS-2368)).

**Goal:** Implement encryption at rest for sensitive fields in local `.db` files, with automatic encryption/decryption during normal application use, fully transparent to users and to the business logic layer.

**Terminology:** A **datastore** is one NeDB `Datastore`, persisted as one `insomnia.<Type>.db` file. There is one datastore per model type (44 in total). This is unrelated to an Insomnia **Collection**, which is a Workspace with `scope: 'collection'` stored as a document in `insomnia.Workspace.db`.

## 2. Sensitive Fields Analysis

An audit of all 40+ data models identified 12+ models containing sensitive fields, with nesting depths of 1–3 levels:

| Model                                           | Sensitive Field Paths                                                                                                                           | Nesting Depth |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Request                                         | `authentication.password`, `.token`, `.clientSecret`, `.accessToken`, `.refreshToken`, `.secretAccessKey`, `.sessionToken`, `.privateKey`, etc. | 2             |
| ClientCertificate                               | `passphrase`, `cert`, `key`, `pfx`                                                                                                              | 1             |
| GitCredentials                                  | `credentials.token`, `credentials.password`, `refreshToken`                                                                                     | 1–2           |
| CloudCredential                                 | `credentials.accessKeyId`, `.secretAccessKey`, `.sessionToken`, `.client_secret`, etc.                                                          | 2             |
| OAuth2Token                                     | `accessToken`, `refreshToken`, `identityToken`                                                                                                  | 1             |
| CookieJar                                       | `cookies[].value`                                                                                                                               | 2             |
| GrpcRequest                                     | `reflectionApi.apiKey`                                                                                                                          | 2             |
| WebSocketRequest / SocketIORequest / McpRequest | Same authentication fields as Request                                                                                                           | 2             |
| RequestVersion                                  | `compressedRequest` — gzip + base64 snapshot of the full request (including `authentication`), written on every send of a changed request      | 1             |

**Characteristics:** Sensitive fields are mostly `string` types, often nested inside `authentication` objects or array elements.

**Sensitive data inside opaque values:** A field that embeds sensitive data in an encoded form is encrypted as a whole string. RequestVersion's `compressedRequest` is a gzip + base64 copy of the entire request, so encrypting only the Request's `authentication.*` fields would leave the same secrets readable in `insomnia.RequestVersion.db`.

**Out of scope — confidential environment variables:** Environment variables can be flagged as confidential (`kvPairData[].isConfidential`, serialized as `confidentialKeys` in v5 export and Git Sync YAML). This flag is a display-masking policy (preview, timeline, generated code) and does not change how values are stored. This design does **not** encrypt confidential variables; their values remain plaintext in the local database. Environment variables of type `SECRET` are already encrypted by the Vault.

## 3. Approaches Explored & Comparison

The design space was evaluated along two dimensions: **where** to perform encryption (the layer) and **what key** to use (the key management strategy).

### 3.1 Dimension 1: Encryption Layer

**Note on "Query Impact":** NeDB keeps all documents in memory for querying. If encryption happens _above_ the in-memory layer (e.g., at the DB method level), in-memory data contains ciphertext, and queries like `find({ 'authentication.token': 'secret123' })` will fail because the stored value is encrypted. If encryption happens _below_ the in-memory layer (e.g., at the serialization/disk layer), in-memory data is always plaintext, so all queries work normally regardless of which fields are encrypted.

| Approach                                                       | Description                                                                                                                                                                                                   | Query Impact                                               | Code Invasiveness                                                                   | Verdict        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| **NeDB Serialization Hooks**                                   | Use [`afterSerialization` / `beforeDeserialization`](https://github.com/seald/nedb/blob/HEAD/API.md#serializationhook--string--promisestring) constructor options to encrypt/decrypt at the storage I/O layer | ✅ None — in-memory data is always plaintext               | Minimal — only `init()` changed                                                     | **✅ Adopted** |
| Database Method Level                                          | Insert encrypt/decrypt logic into every `insert`, `update`, `find`, `findOne` method                                                                                                                          | ❌ Queries on encrypted fields fail (ciphertext in memory) | High — all DB methods modified; must handle `duplicate`, `batchModifyDocs`, etc.    | ❌ Rejected    |
| Full-database encryption (SQLCipher-style)                     | Replace NeDB with an encrypted database engine                                                                                                                                                                | ✅ None — engine handles transparently                     | Massive — requires rewriting the entire storage layer                               | ❌ Rejected    |
| Encrypted filesystem (EFS/LUKS)                                | Rely on OS-level filesystem encryption                                                                                                                                                                        | ✅ None                                                    | Zero code changes, but requires user to configure OS-level encryption; not portable | ❌ Rejected    |
| Full-document encryption (entire JSON line)                    | Encrypt the whole serialized line in NeDB hooks                                                                                                                                                               | ✅ None — same hook mechanism                              | Minimal, but `.db` files become completely opaque; impossible to debug              | ❌ Rejected    |
| Application-level per-field encryption (current Vault pattern) | Each business module manually calls encrypt/decrypt for specific fields                                                                                                                                       | ✅ None (manual)                                           | Scattered across codebase; easy to miss fields; not transparent                     | ❌ Rejected    |

**Decision:** NeDB Serialization Hooks with field-level encryption — best balance of transparency, query compatibility, and minimal code changes.

### 3.2 Dimension 2: Encryption Key Strategy

#### Electron safeStorage

Uses Electron's [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage) API, which delegates to the OS-native credential storage (Windows DPAPI, macOS Keychain, Linux Secret Service) to encrypt data. The encryption key is managed entirely by the operating system and tied to the current user session. Insomnia already uses this API to protect the Vault Key locally.

- **Pros:** Zero user interaction; OS-level security; key never exposed to application code
- **Cons:** Machine-bound — encrypted data cannot be decrypted on another machine or by another OS user; **completely unavailable in non-Electron environments (inso CLI)**; non-deterministic encryption (same plaintext → different ciphertext each time)

#### Vault Key Generation

Reuses the existing Insomnia Vault Key — a standalone AES-256 key generated locally by the application, independent of the account key hierarchy. Insomnia already uses this key for encrypting environment secrets (the "Vault" feature). User must manually trigger generation, save/backup the key, and provide it when needed (e.g., on new devices or in CLI).

- **Pros:** Fully user-controlled; key never changes unless user explicitly resets; decoupled from account lifecycle
- **Cons:** High-friction UX — requires a mandatory "generate and save" step; key loss is catastrophic (no server recovery); users must manage yet another secret

#### Account symmetricKey

The user's existing account-level AES-256 symmetric key, which is part of Insomnia's E2EE key hierarchy. It is automatically obtained from the server during the login flow (decrypted from `encSymmetricKey` using the one-time auth box key). Currently used to decrypt the user's RSA private key for cloud sync operations.

- **Pros:** Zero user interaction; key is server-stored (encrypted) so it can be recovered by re-logging in; compatible with CLI via explicit parameter; same key across all devices for the same account
- **Cons:** Key changes when user resets passphrase or toggles E2EE on the website — previously encrypted local data becomes unreadable with the new key; **requires login — unavailable in Scratch Pad mode**

#### Locally Generated Key (auto-generated + safeStorage protected)

A local AES-256 key auto-generated on first launch of the Insomnia App (regardless of login state), protected at rest by Electron's asynchronous `safeStorage` API (`encryptStringAsync` / `decryptStringAsync`, introduced in Electron 42). The key is device-specific, stable, and always available. Users can export it from Preferences for use with inso CLI.

- **Pros:** Zero user interaction (auto-generated on first launch); always available — works in Scratch Pad mode without login; key never changes (stable across passphrase resets, E2EE toggles); no dependency on account lifecycle or server; protected by OS-level security (safeStorage); OS-side key/provider rotation only re-wraps the key file and never touches `.db` ciphertext (see 4.2.1)
- **Cons:** Machine-bound — key cannot be recovered from server if lost (user must export it manually for cross-machine use); if safeStorage is corrupted (e.g., OS reinstall), key is lost

| Approach                  | User Interaction                          | CLI Compatible                                 | Key Recovery                      | Key Stability                                | Works Without Login | Verdict        |
| ------------------------- | ----------------------------------------- | ---------------------------------------------- | --------------------------------- | -------------------------------------------- | ------------------- | -------------- |
| **Locally Generated Key** | ✅ Zero — auto-generated on first launch  | ✅ Via `--encryption-key` + Preferences export | ⚠️ Must export manually           | ✅ Stable — never changes                    | ✅ Yes              | **✅ Adopted** |
| Account symmetricKey      | ✅ Zero — obtained automatically at login | ✅ Via `--encryption-key` + Preferences export | ✅ Re-login to obtain from server | ❌ Changes on passphrase reset / E2EE toggle | ❌ No               | ❌ Rejected    |
| Vault Key Generation      | ❌ Requires manual generation + backup    | ✅ Via `--vault-key` parameter                 | ❌ Lost key = permanent data loss | ✅ Stable unless user resets                 | ✅ Yes              | ❌ Rejected    |
| Electron safeStorage      | ✅ Zero — OS-managed                      | ❌ Not available in Node.js CLI                | ❌ Machine-bound; cannot transfer | ✅ Stable per machine                        | ✅ Yes              | ❌ Rejected    |

**Decision:** Locally Generated Key — zero user friction, always available (including Scratch Pad mode), stable key that never changes, CLI-compatible via export.

### 3.3 Final Combination

**NeDB Serialization Hooks** (layer) + **Locally Generated Key** (key) = Transparent field-level encryption at the storage I/O boundary, using a device-local key that is auto-generated on first launch and always available regardless of login state.

## 4. Final Design

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 Application Layer                   │
│  (React Router loaders/actions, Network, Sync)      │
│  ← Completely unaware of encryption; operates on    │
│     plaintext data                                  │
└───────────────────────┬─────────────────────────────┘
                        │ database API (find/insert/update)
┌───────────────────────▼─────────────────────────────┐
│              NeDB In-Memory Engine                  │
│  ← Queries, indexing, sorting all happen here;      │
│     operates on plaintext data                      │
└───────────────────────┬─────────────────────────────┘
                        │ serialize / deserialize
┌───────────────────────▼─────────────────────────────┐
│       afterSerialization / beforeDeserialization    │
│  ← Field-level encrypt/decrypt executed here        │
│  ← Uses locally generated key (AES-256-GCM)         │
└───────────────────────┬─────────────────────────────┘
                        │ File I/O
┌───────────────────────▼─────────────────────────────┐
│               .db files (disk)                      │
│  ← Sensitive fields encrypted; non-sensitive fields │
│     remain in plaintext                             │
└─────────────────────────────────────────────────────┘
```

### 4.2 Encryption Algorithm & Key

- **Algorithm:** AES-256-GCM (random 12-byte IV, 128-bit authentication tag)
- **Key:** Locally generated AES-256 key — auto-generated on first launch of the Insomnia App, regardless of login state
- **Key generation:** On first launch, if no local encryption key exists, generate a new AES-256 key using `crypto.subtle.generateKey` (or equivalent)
- **Key local protection:** Encrypted with Electron's asynchronous `safeStorage` API before storing locally (see 4.2.1)
- **Key storage location:** Stored in a dedicated local file (e.g., `<dataPath>/.encryption-key`), protected by safeStorage
- **Encrypted value format:** `enc:v1:` + base64(`iv` (12 bytes) ‖ `tag` (16 bytes) ‖ `ciphertext`)
  - **Compact:** the binary parts are concatenated and base64-encoded once. A JSON envelope (e.g. base64 of `{iv, t, ad, d}` with hex/base64 inside) would make each value more than twice as large
  - **Versioned:** `v1` allows a future change of algorithm or layout; readers dispatch on the version and keep decoding older versions
  - **JSON-safe:** only the base64 alphabet, so the value never needs escaping inside the serialized line and can be located in the raw line without parsing it
- **Bootstrapping:** Load and decrypt the local encryption key from safeStorage → pass it to `mainDatabase.init()` → hooks are attached to every datastore of that database instance

#### 4.2.1 Key Protection with Asynchronous safeStorage

The key file is protected with `safeStorage.encryptStringAsync()` / `decryptStringAsync()` (Electron 42+; Insomnia is on Electron 43). Findings below come from the [Electron safeStorage Async API Research and Test Summary](https://konghq.atlassian.net/wiki/spaces/ST/pages/5774245941/Electron+safeStorage+Async+API+Research+and+Test+Summary) (Electron source review + tests on WSL/Linux).

**Why async, not sync:** The two APIs are different code paths — sync uses `OSCrypt`, async uses `os_crypt_async::Encryptor` — so `isEncryptionAvailable()` and `isAsyncEncryptionAvailable()` are **not equivalent**. On Linux with the `basic_text` backend, sync availability was `false` (sync `encryptString` threw "Encryption is not available") while async availability was `true` and `encryptStringAsync` succeeded. The existing sync helper in `src/main/ipc/secret-storage.ts` falls back to storing the value **in plaintext** when sync encryption is unavailable; the local encryption key must never take that path.

**Rules:**

1. **Only after `app.whenReady()`.** `isAsyncEncryptionAvailable()` resolves `false` immediately when called before `ready`. `initDatabase(mainDatabase)` is already called inside `app.on('ready')` in `entry.main.ts`, so loading the key in `mainDatabase.init()` satisfies this. Key loading must not move earlier.
2. **Pre-flight check:** Call `isAsyncEncryptionAvailable()` after `ready` as a signal, but still treat every encrypt/decrypt call as fallible — after `ready`, errors surface during operations rather than in the availability check.
3. **Always `try/catch`.** Temporary unavailability is **not** a field in the success payload; it is a Promise rejection from `decryptStringAsync` with a message like `safeStorage.decryptStringAsync is temporarily unavailable. Please try again.`
4. **Bounded exponential backoff for temporary unavailability only.** Detect the error by its "temporarily unavailable" message and retry: 5 attempts, 120 ms base delay, 2000 ms cap, 20% jitter. Any other error fails immediately.
5. **Handle `shouldReEncrypt`.** `decryptStringAsync` resolves `{ result, shouldReEncrypt }`; `shouldReEncrypt: true` signals an OS-side key/provider rotation. Re-encrypt the plaintext key with `encryptStringAsync` and write the new ciphertext back to the key file (write to a temp file, then rename, so a crash cannot leave a half-written key file). The local AES key itself does not change, so `.db` ciphertext is unaffected.
6. **Never delete or regenerate on failure.** A temporary-unavailable error, exhausted retries, or a non-retriable decrypt error must leave the key file untouched. A new key is generated **only when the key file does not exist**. Regenerating over an unreadable key file would orphan every encrypted field on disk.
7. **Recoverable degraded state.** If retries are exhausted or decryption fails, the database opens in degraded mode (see 4.3) and the user is shown the decryption failure dialog (5.2). The next launch retries normally.

**First launch when protection fails:** If no key file exists and `encryptStringAsync` fails after retries, the key is **not** persisted in plaintext. Encryption is not enabled for that session (data stays in its current plaintext state and migration is deferred), and key generation is retried on the next launch.

The wrapper is implemented in the main process (e.g., `src/main/local-encryption-key.ts`), following the reference `decryptWithAutoRotate` / `encryptWithRetry` / `withExponentialBackoff` implementation in the research page's appendix. The existing Vault Key helpers in `secret-storage.ts` are out of scope and keep using the sync API.

### 4.3 NeDB Serialization Hooks

`createNedbDatabase()` returns independent instances, each with its own datastores and change listeners. Besides the main-process `mainDatabase`, there are in-memory scratch instances (e.g. the Git Sync canonical-file scratch DB in `sync/git/canonical-file.ts`, the in-memory DB in `network/send-request.node.ts`, and the Vitest setups). The encryption key is therefore passed **per instance through `init()` options**, never held in module-level state:

```typescript
// packages/insomnia-data/node-src/database/database-nedb.ts
type initOptions = DataStoreOptions & { dbPath?: string; fieldEncryptionKey?: FieldEncryptionKey };

init: async ({ dbPath, fieldEncryptionKey, ...config }: initOptions = {}, forceReset = false) => {
  // { afterSerialization, beforeDeserialization, testSerializationHooks: false }
  const encryptionHooks =
    fieldEncryptionKey && !config.inMemoryOnly ? createFieldEncryptionHooks(fieldEncryptionKey) : {};
  const defaultConfig: NeDB.DataStoreOptions = {
    autoload: true,
    corruptAlertThreshold: 0.9,
    ...config,
    ...encryptionHooks,
  };
  // every datastore is created from defaultConfig, so all datastores of this instance get the hooks
  // ...
};
```

```typescript
// packages/insomnia/src/main/database.main.ts
init: async (config: DataStoreOptions = {}, forceReset = false) => {
  const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
  // safeStorage-protected local key (4.2.1); not needed (and not loaded) for in-memory instances.
  // Resolves undefined when the key cannot be loaded or created → degraded mode.
  const fieldEncryptionKey = config.inMemoryOnly ? undefined : await getLocalEncryptionKey(dbPath);
  await nedbDatabase.init({ dbPath, fieldEncryptionKey, ...config }, forceReset);
  // ...
};
```

- **afterSerialization(line):** Called before writing to disk. Parses the JSON line → looks up the encrypted field paths for the doc's `type` (see 4.4) → encrypts matching field paths → re-stringifies
- **beforeDeserialization(line):** Called after reading from disk. Parses the JSON line → detects values with `enc:v1:` prefix → decrypts → re-stringifies. Never throws (see 4.3.1)
- **`testSerializationHooks: false`:** NeDB's self-test feeds random non-JSON strings through the hooks, which JSON-parsing hooks cannot handle
- **Persistent instances only:** `inMemoryOnly` instances never write to disk, so they get no hooks and require no key
- **Shared hook factory:** `createFieldEncryptionHooks()` lives in `insomnia-data` (Node side) so inso CLI's `ne-db-adapter.ts`, which constructs `NeDB` directly, reuses the same implementation
- **Key normally available in the app:** The local key is generated on first launch and present on every later launch. The only exception is a safeStorage failure (4.2.1), handled by degraded mode below
- **Degraded mode (no usable key):** The main database is initialized without `fieldEncryptionKey`, so no hooks are attached. `enc:` values are ordinary strings to NeDB, so they load and save verbatim — no data loss — but are non-functional until the key can be decrypted again (the decryption failure dialog in 5.2 is shown). Sensitive values written during a degraded session stay plaintext; the next healthy launch encrypts them automatically, because every load rewrites each datastore through the hooks (section 6). Migration therefore never happens in a degraded session

#### 4.3.1 Hook Error Handling — Hooks Must Never Lose Data

**Why this matters:** NeDB (`@seald-io/nedb` 4.x, `treatRawStreamAsync`) catches any error thrown while deserializing a line — including from `beforeDeserialization` — counts the line as corrupt and **skips it**. Insomnia sets `corruptAlertThreshold: 0.9`, so up to 90% of lines can be skipped without any error. Because every load ends with a full rewrite (`persistCachedDatabaseAsync()`), skipped documents are then **permanently removed** from the `.db` file. A single throwing decrypt would silently delete a user's request.

**`beforeDeserialization` never throws:**

- The whole hook is wrapped in `try/catch`; any failure returns a line NeDB can still load.
- **Per-field decrypt failure** (wrong key, GCM authentication failure, truncated or malformed `enc:v1:` value): keep the original `enc:v1:` value verbatim and continue with the remaining fields. The document loads; only that field is non-functional.
- **Record every failure** as `{ type, _id, path }` in an in-memory failure report owned by the database instance. After init, the main process exposes the report to the renderer, which shows the decryption failure dialog (5.2) when it is non-empty.
- **Line the hook cannot parse** (genuinely corrupt JSON): return the line unchanged, so NeDB's existing corrupt-line handling applies exactly as it does today. Encryption must not change which lines count as corrupt.
- **Lookalike values:** a plaintext string that happens to start with `enc:v1:` fails GCM authentication and is likewise kept verbatim — never dropped or cleared.

**`afterSerialization` never writes plaintext for an encrypted field:**

- **Values already starting with `enc:v1:` are written unchanged**, never encrypted again. This keeps values that failed decryption byte-identical across rewrites, so they remain recoverable once the correct key is available.
- **If encryption itself fails**, the hook throws instead of falling back to plaintext. NeDB builds all lines before touching the file, so nothing partial is written:
  - During an insert/update, the operation rejects. NeDB has already applied the change in memory, so it is lost on restart; the error surfaces to the caller.
  - During the startup rewrite, that datastore's load rejects and its `.db` file is left untouched (see "Load failures" below).
- With a valid `KeyObject` already in memory, encryption failure indicates a programming error, not a runtime condition; tests (below) guard against it.

**Load failures must surface as errors, not hangs:** Each datastore is created with `autoload: true`, which starts its load immediately; Insomnia currently neither passes `onload` nor awaits `autoloadPromise`. If a load rejects, NeDB rethrows it as an unhandled rejection and never marks the datastore ready, so every query on it waits forever — `init()` then hangs in `repairDatabase()` and no window ever appears. `init()` therefore awaits every datastore's `autoloadPromise` (`Promise.allSettled`) and rejects with an error naming the failed datastores. Startup reports that error to the user instead of hanging. The failed `.db` files are untouched, so nothing is lost.

**Tests:** For each encrypted model, cover wrong key, tampered ciphertext, truncated value, lookalike plaintext, and unparseable line. Assert that the document count is unchanged after load + rewrite, failed values are preserved byte-for-byte, and the failure report lists exactly the affected `{ type, _id, path }`.

### 4.4 Encrypted Fields Definition

Models are defined as Zod schemas (each model exports `schema = createModelSchema(type, prefix).extend(...)`). Sensitive fields are **marked directly on the schema field**, and the encrypted field paths are **derived from the schema**. The marking sits next to the field definition, so adding or renaming a field cannot drift out of sync with a separately maintained path list.

```typescript
// packages/insomnia-data/src/models/utils/encrypted-field.ts
import { z } from 'zod/v4';

// A dedicated registry rather than `.meta()` / globalRegistry: `z.toJSONSchema()` is used to generate the
// published insomnia.schema JSON, and globalRegistry metadata would leak into it.
export const encryptedFieldRegistry = z.registry<{ encrypted: true }>();

export const encrypted = <T extends z.ZodType>(schema: T): T => schema.register(encryptedFieldRegistry, { encrypted: true });
```

```typescript
// packages/insomnia-data/src/models/request.ts
export const AuthTypeBasicSchema = z.object({
  // ...
  password: encrypted(z.string()).optional(),
});

// packages/insomnia-data/src/models/cookie-jar.ts
export const CookieSchema = z.object({
  // ...
  value: encrypted(z.string()).optional().default(''),
});
```

**Path derivation** (`getEncryptedFieldPaths(schema)`) runs once per model `schema` and produces a `Record<AllTypes, string[]>` used by `afterSerialization`:

- `ZodObject` → recurse into each key (`authentication.password`)
- `ZodArray` → `[]` segment: `cookies[].value` means encrypt the `value` field for every element in the array
- `ZodOptional` / `ZodNullable` / `ZodDefault` / `ZodPipe` → unwrap; a field is encrypted if the inner schema or any wrapper layer is registered
- `ZodUnion` / `ZodDiscriminatedUnion` → union of the paths of all options. E.g. Request `authentication` is a discriminated union of 13 auth types, so `authentication.password` is collected once from Basic, Digest, NTLM and OAuth2
- Only `string` leaves may be marked, since the encrypted value format is a string; derivation throws otherwise

**Trade-off:** Union paths are merged by field name, not by discriminator. A name that is a secret in one variant but not in another (Hawk `key` is a secret; API Key auth's `key` is the header name) is encrypted in both. This over-encrypts a harmless value in exchange for a simple path syntax with no discriminator-aware rules.

**Models not yet on Zod:** ClientCertificate, CloudCredential, OAuth2Token, GitCredentials and RequestVersion are still plain interfaces. Phase 5 migrates them to Zod schemas following the existing `createModelSchema` pattern so all models use one mechanism. Until a model is migrated, it may export a literal `encryptedFields: string[]`, which is merged into the same map and removed once the model is migrated.

A snapshot unit test of the derived map makes every change to the set of encrypted fields visible in code review.

### 4.5 Impact on Existing Features

| Feature          | Impact             | Reason                                                                          |
| ---------------- | ------------------ | ------------------------------------------------------------------------------- |
| Database queries | ✅ No impact       | Queries execute on the in-memory layer; in-memory data is plaintext             |
| Cloud Sync       | ✅ No impact       | Sync reads in-memory plaintext data                                             |
| Git Sync         | ✅ No impact       | NeDBClient reads in-memory data via `db.findOne()`                              |
| Import/Export    | ✅ No impact       | Export reads in-memory data; import writes trigger automatic encryption         |
| In-memory DBs    | ✅ No impact       | `inMemoryOnly` scratch instances never serialize to disk; no hooks, no key      |
| inso CLI         | ⚠️ May require key | Only if reading encrypted `.db` files directly; git/export workflows unaffected |

## 5. User Interaction Impact

> ✅ **This solution is fully transparent to all users at all times.** No key generation prompts, no login required, no backup prompts. Encryption works from the very first launch.

### 5.1 Normal User Flow (Zero Interaction)

```
First launch → Local encryption key auto-generated
            → Key protected with async safeStorage (after app ready)
            → All DB reads/writes automatically encrypted/decrypted
            → User is completely unaware of encryption
            → Works in both logged-in mode and Scratch Pad mode
```

### 5.2 Decryption Failure Handling

Decryption failures are rare with this approach (only if safeStorage is corrupted, e.g., after OS reinstall). Temporary safeStorage unavailability is retried with backoff first and never reaches the user; the dialog is shown only when retries are exhausted or the key file fails to decrypt with a non-retriable error (4.2.1), and the database is then running in degraded mode (4.3). The key file is never deleted or regenerated automatically. When it occurs, the application **must not silently fail**. Instead:

1. **Show a dialog** explaining that some locally encrypted data could not be decrypted
2. **Provide context:** "This may happen if the application data was moved from another machine or the OS credential store was reset"
3. **Offer options:**
   - **"Reset affected fields"** — Clear the values of fields that failed decryption (user will need to re-enter passwords/tokens)
   - **"Continue without decryption"** — Leave `enc:` prefixed values as-is (fields will be non-functional but data is preserved for potential recovery)
4. **Show details:** List which documents/fields are affected so the user knows what to re-enter

### 5.3 Encryption Key Export & inso CLI Usage

To support inso CLI and other tooling that needs to decrypt `.db` files, a new section is added to the **Preferences** modal (General tab) for exporting the encryption key:

**Location:** Preferences → General → "Local Encryption Key" section

**UI Elements:**

- **"Local Encryption Key"** section header with brief explanation: "This key is used to encrypt sensitive fields in your local database. You may need it for CLI usage."
- **"Copy Key"** button — copies the local encryption key (base64 JWK) to clipboard
- **"Export Key"** button — downloads the key as a `.json` file (e.g., `insomnia-encryption-key.json`)
- **Security notice:** "Keep this key secure. Anyone with this key can decrypt your locally stored passwords and tokens."

**Availability:** Always available (key exists from first launch).

**inso CLI usage with the exported key:**

Most CI/CD workflows use git sync (YAML files) or export files, which contain plaintext and are **not affected**. For the rare case of reading encrypted `.db` files directly, the exported key can be passed to inso CLI:

```bash
inso run collection "My Collection" --workingDir ./data --encryption-key "JWK_STRING"
# Or use an environment variable
INSOMNIA_ENCRYPTION_KEY="JWK_STRING" inso run collection "My Collection"
```

## 6. Data Migration Plan

### 6.1 Design Principles

- **Fail-safe:** no exception may lead to data loss.
- **Invisible to the user:** no progress screen, no prompt, no backup step. The user only sees something when a failure occurs (the decryption failure dialog in 5.2, or a startup error from 4.3.1).

### 6.2 Migration Is the First Load with Hooks

At the end of every load, NeDB rewrites the whole datastore (`persistCachedDatabaseAsync()` in `loadDatabaseAsync`, `@seald-io/nedb` 4.x). So the first launch that initializes the main database with the encryption key reads the existing plaintext values (backward-compatible reads: a value without the `enc:v1:` prefix is plaintext) and writes every datastore back through `afterSerialization`, with all sensitive fields encrypted. There is no separate migration step, no compaction pass and no migration state.

First launch of the new version:

1. Load the local key, or create it if the key file does not exist (6.3).
2. Call `mainDatabase.init()` with the key. Each datastore loads and is rewritten encrypted.
3. Done.

Every later launch performs the same rewrite. The same mechanism encrypts plaintext values written during a degraded session (4.3) or by an older Insomnia version (6.5) at the next healthy launch.

**Timing and cost:**

- `initDatabase(mainDatabase)` runs in `app.on('ready')` before any window is created, and all datastores load concurrently (`autoload: true`). Migration therefore runs before any UI exists, which is why it has no UI.
- The cost of the first launch is the same encrypt pass that every later launch performs, with nothing to decrypt; see [field-encryption-performance.md](./field-encryption-performance.md).

### 6.3 Key Before Data

The key must be durably persisted and verified **before** any datastore is written with encryption. Otherwise a crash after the `.db` files are encrypted, but before the key is safely on disk, makes the data permanently unreadable.

1. Generate the AES-256 key.
2. Protect it with `encryptStringAsync` (4.2.1).
3. Write it to a temp file, flush it to disk, then rename it to the key file.
4. Read the key file back, decrypt it with `decryptStringAsync`, and compare it with the in-memory key.
5. Only then initialize the database with hooks.

If any of steps 1–4 fails, the "first launch when protection fails" path in 4.2.1 applies: encryption is not enabled for this session, and key creation is retried on the next launch.

### 6.4 Why Interruption Is Safe

- **Each file is replaced atomically:** NeDB's `crashSafeWriteFileLinesAsync` writes `<file>~`, flushes it, then renames it over the `.db` file, and `ensureDatafileIntegrityAsync` recovers from a crash between the two on the next load. Each `.db` file is therefore entirely old or entirely new.
- **A mixed state is readable:** If the app is killed mid-migration, some datastores are encrypted and others are still plaintext. Both read correctly.
- **The next launch completes it:** Every load rewrites every datastore, so no status file or resume logic is needed.
- **No document is dropped and no failure hangs:** Hooks never throw on read, and datastore load failures surface as errors with the `.db` file untouched (4.3.1).

### 6.5 Downgrade to a Version Without Encryption (Known Limitation)

- The older version reads `enc:v1:` values as literal strings. All other data works, but encrypted fields (passwords, tokens, cookie values, ...) are non-functional, and features that decode an encrypted field fail (e.g. restoring a request from response history via RequestVersion's `compressedRequest`).
- The older version writes `enc:v1:` strings back verbatim, so they stay recoverable. Values the user re-enters there are written in plaintext.
- Upgrading again reads the mixed state, and the next load encrypts the plaintext values.
- No data is lost, but the user must re-enter secrets while on the older version.

### 6.6 Backups

- **No separate pre-migration backup.** Users who update through the updater already have one: when a newer version is available, the running version copies all `.db` files to `<dataPath>/backups/<version>/` (`src/main/backup.ts`).
- **Existing backups are not modified.** Backups written by versions before encryption remain plaintext copies in `backups/`. This is a known limitation and out of scope.
- **Restoring still works.**
  - Backups written by encryption-enabled versions contain encrypted values and restore on the same machine, because the local key is stable.
  - Restoring a pre-encryption backup (`restoreBackup()`) also works: plaintext is read as-is and encrypted on the next load.

## 7. Implementation Plan

| Phase   | Content                                          | Estimated Changes                           |
| ------- | ------------------------------------------------ | ------------------------------------------- |
| Phase 1 | Field encryption utility (`field-encryption.ts`) | 1 new file + tests                          |
| Phase 2 | Integrate hooks into `database-nedb.ts` `init()` (per-instance key via init options, skip `inMemoryOnly`); pass key from `database.main.ts` | 2 files modified |
| Phase 3 | Local key generation + async safeStorage protection (retry with backoff, `shouldReEncrypt` write-back, atomic key file write, degraded mode) | 1–2 new files + tests |
| Phase 4 | Decryption failure dialog UI                     | 1–2 new files                               |
| Phase 5 | `encrypted()` registry + schema path derivation; mark sensitive fields in model schemas; migrate ClientCertificate / CloudCredential / OAuth2Token / GitCredentials / RequestVersion to Zod | 1 new file + tests; 12+ model files modified |
| Phase 6 | inso CLI `--encryption-key` support (reuse `createFieldEncryptionHooks()` in `ne-db-adapter.ts`) | 2–3 files modified |
| Phase 7 | Encryption key export/copy in Preferences UI     | 1–2 files modified                          |
| Phase 8 | Migration: durable key creation + verification before first encrypted write; `init()` awaits every datastore load | 1–2 files modified |

## 8. Open Questions

1. **Performance impact** — Every read/write requires JSON parsing + field traversal + AES encrypt/decrypt; benchmark testing is needed to verify impact. Optimizations to apply after the baseline implementation, and the benchmark used to compare the two, are in [field-encryption-performance.md](./field-encryption-performance.md)
2. **Encryption granularity** — Should users be able to customize which fields are encrypted, or should the system define this uniformly? (Current design: system-defined)
3. **Linux `basic_text` backend** — Async encryption succeeds on `basic_text` (where sync reports unavailable), but that backend has no OS keyring behind it, so the protection it gives the key file is likely much weaker than DPAPI / Keychain / Secret Service. Should we detect it via `safeStorage.getSelectedStorageBackend()` and log or warn? Needs verification of what the async path actually uses on `basic_text`.
