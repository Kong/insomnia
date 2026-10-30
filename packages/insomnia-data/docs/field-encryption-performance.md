# NeDB Field-Level Encryption: Performance Optimizations

Companion to [field-encryption-design.md](./field-encryption-design.md).

## 1. Approach

Implementation happens in two steps so the effect of each optimization can be measured:

1. **Baseline:** implement the design in `field-encryption-design.md` as written (straightforward hooks: parse → encrypt/decrypt → stringify).
2. **Optimized:** apply the optimizations below on top of the baseline, then re-run the same benchmark.

Both steps use the same benchmark (section 6) so the results are directly comparable.

## 2. Where the Cost Is

Findings from `@seald-io/nedb` 4.1.2 source (`lib/persistence.js`):

- **Every startup rewrites every datastore (`.db` file).** `loadDatabase` feeds each line through `beforeDeserialization`, then unconditionally calls `persistCachedDatabaseAsync()` (`persistence.js:339`), which runs every document back through `afterSerialization`. So each startup = one full decrypt pass + one full encrypt pass. The migration is simply the first such load with the key (design doc section 6).
- **Normal writes are incremental.** An insert/update appends one serialized document; the hook cost is tens of microseconds and not a concern.
- **Hooks may be async, but the rewrite awaits them one document at a time** (`persistence.js:97-99`). Any per-call async overhead is multiplied by the document count.
- **NeDB's own (de)serialization** uses `JSON.stringify` / `JSON.parse` with a replacer/reviver function, which is already slower than plain JSON; the hook's extra JSON pass is plain JSON.

**Startup is the hot path.** All optimizations below target the full read and rewrite passes.

## 3. Preliminary Measurements

Synthetic dataset: 5,000 Request documents (1/3 no auth, 1/3 bearer, 1/3 OAuth2 with 4 secret fields; ~1.5 KB JSON body each) + 1 CookieJar with 500 cookies. 14.6 MB serialized, ~8.8k encrypted values. Node 24.18 (matches `.nvmrc`), Windows 11, median of 5 runs. One full pass over all documents:

| Scenario                                       | Read pass  | Write pass |
| ---------------------------------------------- | ---------- | ---------- |
| NeDB alone (no encryption)                     | 85 ms      | 30 ms      |
| Baseline hooks (parse + AES + stringify)       | +80 ms     | +85 ms     |
| Optimized (O3 read, O5 write)                  | +43 ms     | +42 ms     |
| Plain `JSON.parse` + `JSON.stringify` per line | 33 ms      | 33 ms      |

**Takeaway:** In the baseline hooks, AES costs about as much as the extra JSON pass. Per value, AES-256-GCM costs ~3–5 µs, mostly `createCipheriv` object setup and `randomBytes(12)`, not the cipher itself.

These numbers are synthetic. Section 6 defines the measurement used for the real baseline-vs-optimized comparison.

## 4. Optimizations

Ordered by expected impact. None of them changes the on-disk format (see section 5).

### O1. Synchronous `node:crypto` in hooks, not WebCrypto

- **What:** Implement encrypt/decrypt with `crypto.createCipheriv` / `createDecipheriv` (`aes-256-gcm`). Create the `KeyObject` once (`crypto.createSecretKey`) at init and reuse it. `crypto.subtle.generateKey` is still fine for one-time key generation.
- **Why:** WebCrypto is async-only and hops to a thread pool on every call; NeDB's rewrite awaits each document serially, so that overhead is paid N times.
- **Measured:** 20k encryptions — WebCrypto awaited serially 665 ms vs `node:crypto` 106 ms (~6×).

### O2. Attach hooks per datastore, only where needed

- **What:** Create hooks per datastore instead of one shared `defaultConfig`. Only the ~10 datastores whose model declares encrypted fields get hooks; the hook is created knowing its type and path list, so it never has to read `type` from the line.
- **Why:** Response, RequestMeta, Stats, etc. (30+ datastores) then pay zero cost.
- **Measured:** Not reflected in section 3 (the dataset contains only encrypted types). The gain equals the full hook cost of every non-sensitive datastore.

### O3. Read without parsing: prefix check + regex splice

- **What:** In `beforeDeserialization`:
  1. `line.indexOf('"enc:') === -1` → return the line unchanged.
  2. Otherwise replace each `"enc:v1:<base64>"` token via regex with `JSON.stringify(decrypt(token))`. No `JSON.parse` / `JSON.stringify` of the whole line.
- **Why:** Avoids the full parse + stringify on the read pass.
- **Safety:**
  - Relies on the base design's value format (design doc 4.2): the ciphertext uses only the base64 alphabet (no characters that need JSON escaping) behind a distinctive, versioned `enc:v1:` prefix.
  - A plaintext string that happens to look like a token fails GCM authentication; it must then be left unchanged, never dropped. The benchmark data includes such a lookalike and round-trips correctly.
  - Decryption is prefix-based and path-agnostic, consistent with the baseline design.
- **Measured:** Read pass 80 ms → 43 ms; the remainder is mostly AES.

### O4. Write prefilter on raw field names

- **What:** In `afterSerialization`, check the raw line for any of the datastore's encrypted field names (e.g. `"password":`, `"token":`). If none is present, return the line unchanged without parsing.
- **Why:** Most documents in a sensitive datastore (e.g. requests with no auth) have nothing to encrypt.
- **Measured:** 85 ms → 77 ms on the synthetic data, where 2/3 of requests carry auth. Real data with fewer authenticated requests gains more.

### O5. Reuse ciphertext during the startup rewrite

- **What:** During the read pass, record `docId + path + plaintext → ciphertext`. In the rewrite pass, if a field's plaintext is unchanged, write the recorded ciphertext instead of re-encrypting.
- **Why:** Removes AES from the startup rewrite almost entirely; only values changed since the last write are encrypted.
- **Notes:**
  - The cache key includes the document id, so equal values in different documents never share a ciphertext (no cross-document equality leak).
  - The key includes the plaintext, so a stale entry can never produce a wrong hit.
  - The cache lives only in main-process memory, which already holds the plaintext.
  - Side benefit: `.db` file contents stay stable across startups instead of changing with fresh random IVs.
- **Measured:** Rewrite pass 85 ms → 42 ms (≈ the plain JSON floor).

### O6. Pooled IV generation

- **What:** Draw IVs from a pre-filled `crypto.randomBytes(12 * 4096)` buffer instead of calling `randomBytes(12)` per value.
- **Why:** The per-call overhead of `randomBytes` is a large part of the per-value AES cost. IVs remain random from the CSPRNG, so security is unchanged.
- **Measured:** 20k encryptions 106 ms → 70 ms.

### Considered, not recommended

- **One AES operation per document (envelope):** Encrypt all sensitive values of a document as one blob and leave placeholders in the fields. Write pass 47 ms, but O5 already reaches 42 ms, the format is more complex, and reads can no longer use O3's splice.
- **Patch NeDB with a document-level `beforeSerialization(doc)` hook:** Would remove the write-side extra JSON pass entirely, at the cost of maintaining a patch of a third-party dependency. Last resort only if measurements show O1–O6 are not enough.

## 5. Format Compatibility Between the Two Steps

The compact, versioned value format (`enc:v1:` + base64(`iv` ‖ `tag` ‖ `ciphertext`)) is part of the base design (design doc 4.2), and none of O1–O6 changes what is written to disk. The baseline and optimized implementations therefore read each other's files, and the two steps can ship separately without a legacy decode path.

## 6. Measurement Plan

Run the same benchmark after the baseline step and after the optimized step.

**Datasets:**

- Synthetic generator with a fixed seed (as in section 3), scaled to small / medium / large. Include RequestVersion documents: `compressedRequest` is encrypted as one large string per version, and the datastore grows with every send of a changed request, so it may dominate the encrypted volume
- A copy of a real Insomnia data directory (never the live one)

**Metrics:**

| Metric                                 | How                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Database init time                     | Total `mainDatabase.init()` duration, and per datastore (read + rewrite)          |
| First-launch (migration) init time     | `mainDatabase.init()` on a previously plaintext data directory                    |
| Single write latency                   | `update()` of one Request with auth                                               |
| `.db` file size                        | Per datastore, before vs after encryption                                         |
| Main-process memory                    | Heap after init (relevant for O5's cache)                                         |

**Method:** Same machine and Node/Electron versions for both runs; warm-up run discarded; median of at least 5 runs; record results as below.

| Metric | No encryption | Baseline | Optimized |
| ------ | ------------- | -------- | --------- |
|        |               |          |           |
