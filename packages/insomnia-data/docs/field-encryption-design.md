# NeDB Local Database Field-Level Encryption Design

## 1. Background & Goals

Insomnia uses NeDB as its local embedded database, storing users' API requests, authentication credentials, and other data. This data is saved as plaintext JSON in `.db` files, posing a risk of sensitive information exposure (e.g., auth tokens, passwords, certificate private keys). This was flagged as a security risk in a recent penetration test ([INS-2368](https://konghq.atlassian.net/browse/INS-2368)).

**Goal:** Implement encryption at rest for sensitive fields in local `.db` files, with automatic encryption/decryption during normal application use, fully transparent to users and to the business logic layer.

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

**Characteristics:** Sensitive fields are mostly `string` types, often nested inside `authentication` objects or array elements.

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

A local AES-256 key auto-generated on first launch of the Insomnia App (regardless of login state), protected at rest by Electron's `safeStorage`. The key is device-specific, stable, and always available. Users can export it from Preferences for use with inso CLI.

- **Pros:** Zero user interaction (auto-generated on first launch); always available — works in Scratch Pad mode without login; key never changes (stable across passphrase resets, E2EE toggles); no dependency on account lifecycle or server; protected by OS-level security (safeStorage)
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
- **Key local protection:** Encrypted with Electron `safeStorage` before storing locally
- **Key storage location:** Stored in a dedicated local file (e.g., `<dataPath>/.encryption-key`), protected by safeStorage
- **Encrypted value format:** `enc:` + base64-encoded AESMessage JSON (containing `iv`, `t`, `ad`, `d` fields)
- **Bootstrapping:** Load and decrypt the local encryption key from safeStorage → initialize all NeDB collections with hooks

### 4.3 NeDB Serialization Hooks

```typescript
// In database-nedb.ts init()
new NeDB({
  filename: dbPath,
  afterSerialization: line => encryptDocLine(line, localEncryptionKey),
  beforeDeserialization: line => decryptDocLine(line, localEncryptionKey),
  testSerializationHooks: false, // Disable self-test
});
```

- **afterSerialization(line):** Called before writing to disk. Parses the JSON line → looks up `encryptedFields` based on the `type` field → encrypts matching field paths → re-stringifies
- **beforeDeserialization(line):** Called after reading from disk. Parses the JSON line → detects values with `enc:` prefix → decrypts → re-stringifies
- **Key always available:** The local key is generated on first launch and always present — no pass-through/no-op mode needed

### 4.4 Encrypted Fields Definition

Each model file exports an `encryptedFields` array:

```typescript
// packages/insomnia-data/src/models/request.ts
export const encryptedFields = [
  'authentication.password',
  'authentication.token',
  'authentication.clientSecret',
  'authentication.accessToken',
  'authentication.refreshToken',
  // ...
];
```

Array path syntax is supported: `cookies[].value` means encrypt the `value` field for every element in the array.

### 4.5 Impact on Existing Features

| Feature          | Impact             | Reason                                                                          |
| ---------------- | ------------------ | ------------------------------------------------------------------------------- |
| Database queries | ✅ No impact       | Queries execute on the in-memory layer; in-memory data is plaintext             |
| Cloud Sync       | ✅ No impact       | Sync reads in-memory plaintext data                                             |
| Git Sync         | ✅ No impact       | NeDBClient reads in-memory data via `db.findOne()`                              |
| Import/Export    | ✅ No impact       | Export reads in-memory data; import writes trigger automatic encryption         |
| inso CLI         | ⚠️ May require key | Only if reading encrypted `.db` files directly; git/export workflows unaffected |

## 5. User Interaction Impact

> ✅ **This solution is fully transparent to all users at all times.** No key generation prompts, no login required, no backup prompts. Encryption works from the very first launch.

### 5.1 Normal User Flow (Zero Interaction)

```
First launch → Local encryption key auto-generated
            → Key protected with safeStorage
            → All DB reads/writes automatically encrypted/decrypted
            → User is completely unaware of encryption
            → Works in both logged-in mode and Scratch Pad mode
```

### 5.2 Decryption Failure Handling

Decryption failures are rare with this approach (only if safeStorage is corrupted, e.g., after OS reinstall). When it occurs, the application **must not silently fail**. Instead:

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

### 6.1 Design Principle

The migration process **must be fail-safe** — no exception should lead to data loss.

### 6.2 Migration Strategy

1. **Pre-migration automatic backup:** On first launch after upgrade, before activating encryption, automatically copy all `.db` files to a `<dataPath>/backup-pre-encryption/` directory (timestamped)
2. **One-time full migration with progress UI:** After backup is complete, perform a full migration of all existing data immediately. Show a migration progress screen to the user (e.g., "Encrypting local data... Collection X of Y") while the migration runs. The migration calls `compactDatafileAsync()` on each collection sequentially, which rewrites all data through the `afterSerialization` hook, encrypting all sensitive fields.
3. **Backward-compatible reads:** The `beforeDeserialization` hook always handles unencrypted data gracefully (no `enc:` prefix → treat as plaintext). This ensures the app still works if migration is interrupted.
4. **Migration status tracking:** Write `.encryption-migration-status.json` in the data directory to record each collection's status (pending/completed/failed). On next launch, resume from where it left off if interrupted.
5. **Failure handling:** If any collection migration fails, log the error, mark that collection as failed, and continue with remaining collections. After migration completes (or partially completes), show a summary to the user indicating any failures.
6. **Post-migration verification:** After all collections are migrated, verify document counts match pre-migration counts. If mismatch detected, alert the user and preserve the backup.

### 6.3 Rollback Capability

- The backup directory is retained until the user confirms data integrity (can be manually deleted in settings)
- To rollback: overwrite `.db` files with the backup files to restore pre-encryption state

## 7. Implementation Plan

| Phase   | Content                                          | Estimated Changes                           |
| ------- | ------------------------------------------------ | ------------------------------------------- |
| Phase 1 | Field encryption utility (`field-encryption.ts`) | 1 new file + tests                          |
| Phase 2 | Integrate hooks into `database-nedb.ts`          | 1 file modified                             |
| Phase 3 | Local key generation + safeStorage protection    | 1–2 new files                               |
| Phase 4 | Decryption failure dialog UI                     | 1–2 new files                               |
| Phase 5 | Add `encryptedFields` declarations to each model | 12+ files modified (pure data declarations) |
| Phase 6 | inso CLI `--encryption-key` support              | 2–3 files modified                          |
| Phase 7 | Encryption key export/copy in Preferences UI     | 1–2 files modified                          |
| Phase 8 | Data migration logic + backup + progress UI      | 2–3 files created/modified                  |

## 8. Open Questions

1. **Performance impact** — Every read/write requires JSON parsing + field traversal + AES encrypt/decrypt; benchmark testing is needed to verify impact
2. **Encryption granularity** — Should users be able to customize which fields are encrypted, or should the system define this uniformly? (Current design: system-defined)
3. **Old backup cleanup** — How long to retain pre-encryption backups? (Recommendation: until user manually deletes via settings)
