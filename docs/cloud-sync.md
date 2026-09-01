# Cloud Sync Internals

Insomnia Cloud Sync (shown in the UI as "Insomnia Sync") is a **custom-built, Git-like distributed version control system** that runs in the Electron main process. It stores a workspace's (Workspace/Collection) documents on local disk as content-addressed snapshots, and syncs them end-to-end encrypted to Insomnia Cloud over GraphQL.

It is **completely separate** from [Git Sync](../packages/insomnia/src/sync/git/) (`sync/git/`, built on isomorphic-git) — the only things they share are the conflict-resolution modal component and a handful of low-level utility functions (see below). A workspace goes through either Git Sync (`workspaceMeta.gitRepositoryId` is set) or Cloud Sync, never both.

The VCS engine itself lives in its own npm workspace package, [`packages/insomnia-vcs/`](../packages/insomnia-vcs/), which only depends on `insomnia-data` and `insomnia-api` and never depends back on `packages/insomnia`. The main-process orchestration code lives in [`packages/insomnia/src/main/cloud-sync/`](../packages/insomnia/src/main/cloud-sync/) — just 4 files: the VCS instance pool keyed by `workspaceId` (`vcs.ts`), IPC registration (`ipc.ts`), the orchestration for pulling a remote collection (`pull-backend-project.ts`), and startup-time initialization (`initialization.ts`).

---

## Table of Contents

1. [TL;DR: What a Single Push Actually Does](#tldr-what-a-single-push-actually-does)
2. [Process Layering and the IPC Bridge](#process-layering-and-the-ipc-bridge)
3. [Core Data Model](#core-data-model)
4. [Local Storage Layer](#local-storage-layer)
5. [Content Addressing and Hash Normalization](#content-addressing-and-hash-normalization)
6. [Sync Candidate Set: Which Documents Get Synced](#sync-candidate-set-which-documents-get-synced)
7. [Local Workflow: status → stage → takeSnapshot](#local-workflow-status--stage--takesnapshot)
8. [Remote Workflow: push / pull / fetch](#remote-workflow-push--pull--fetch)
9. [Merge Algorithm](#merge-algorithm)
10. [Cross-Process Round Trip for Conflict Resolution](#cross-process-round-trip-for-conflict-resolution)
11. [Encryption Model](#encryption-model)
12. [Network Layer and GraphQL Contract](#network-layer-and-graphql-contract)
13. [Lifecycle: Initialization, Pull, Deletion](#lifecycle-initialization-pull-deletion)
14. [Renderer Process Integration](#renderer-process-integration)
15. [Known Issues and Design Debt](#known-issues-and-design-debt)
16. [Testing](#testing)

---

## TL;DR: What a Single Push Actually Does

```
Renderer process                  Main process (one VCS instance per workspace)   Insomnia Cloud
─────────────────                 ─────────────────────────────────────────       ──────────────
getSyncItems(workspaceId)
  → StatusCandidate[]
        │
        │ window.main.sync.status(workspaceId, candidates)
        ├──── ipcRenderer.invoke('sync.invoke', workspaceId, 'status', …) ──►
        │                          getVCSForWorkspace(workspaceId) looks up/creates that workspace's VCS instance
        │                          getStagable(index state = HEAD⊕stage, candidates)
        │                          → { stage, unstaged }
        │ ◄────────────────────────
        │ sync.stage(workspaceId, unstaged)
        ├────────────────────────► writes blobContent into blobs/ (gzip, plaintext)
        │                          stage lives in memory, in _stageByBackendProjectId
        │ sync.takeSnapshot(workspaceId, msg)
        ├────────────────────────► newState = parent snapshot's state ⊖ staged ⊕ staged
        │                          id = sha1(projectId ‖ parentId ‖ sorted blobIds)
        │                          appended to branch.snapshots, persisted to disk
        │ sync.push(workspaceId, {teamId,…})
        ├────────────────────────► ensures the remote project exists (first time generates an
        │                            AES-256 key and wraps it with each member's RSA public key)
        │                          linear history check → blobsMissing ────────────►
        │                          ◄────────────────────────── missing[]
        │                          for each missing blob: read raw gzip bytes
        │                            → AES-256-GCM encrypt → JSON
        │                          blobsCreate (batches of ≤2MB / ≤200) ───────────►
        │                          snapshotsCreate (batches of 20) ────────────────►
```

Key points:

- **Blobs are gzip plaintext on disk; encryption only happens right before upload.** The `version-control/` directory on disk is not an encrypted store.
- **The stage exists only in memory** — it's lost on app restart (the blob content is already on disk, but the staged list isn't).
- **The snapshot ID is derived purely from content** — it includes no message and no timestamp.
- **`status` enumerates against the "index" (HEAD overlaid with the stage), not HEAD itself** — see [Local Workflow](#local-workflow-status--stage--takesnapshot).

---

## Process Layering and the IPC Bridge

| Layer | File | Responsibility |
| --- | --- | --- |
| Pure algorithms | [`insomnia-vcs/src/util.ts`](../packages/insomnia-vcs/src/util.ts) (526 lines) | Side-effect-free diff / three-way merge / hashing / index-state computation (`applyStageToState`) |
| VCS engine | [`insomnia-vcs/src/vcs.ts`](../packages/insomnia-vcs/src/vcs.ts) (1492 lines) | Branches, snapshots, blobs, staging, push/pull, GraphQL queries; each instance carries a readonly `workspaceId` |
| Project directory | [`insomnia-vcs/src/backend-projects.ts`](../packages/insomnia-vcs/src/backend-projects.ts) | Operations that don't depend on a "currently active project": listing/creating/removing local projects, querying the remote project list |
| Session and network | [`insomnia-vcs/src/session.ts`](../packages/insomnia-vcs/src/session.ts) | `assertSession`/`getPrivateKey`/the generic `runGraphQL` |
| Storage abstraction | [`insomnia-vcs/src/store/`](../packages/insomnia-vcs/src/store/) | A key→Buffer KV store plus read/write hooks; [`store/current-store.ts`](../packages/insomnia-vcs/src/store/current-store.ts) is a module-level `Store` singleton (`configureStore`/`getStore`) |
| Crypto primitives | [`insomnia-vcs/src/crypt.ts`](../packages/insomnia-vcs/src/crypt.ts) | RSA/AES-GCM, built on node-forge |
| Instance pool / context | [`main/cloud-sync/vcs.ts`](../packages/insomnia/src/main/cloud-sync/vcs.ts) | The VCS instance pool keyed by `workspaceId`, the conflict callback, `AsyncLocalStorage` |
| IPC registration | [`main/cloud-sync/ipc.ts`](../packages/insomnia/src/main/cloud-sync/ipc.ts) | `sync.invoke` and 4 other channels |
| Preload bridge | [`entry.preload.ts:153-205`](../packages/insomnia/src/entry.preload.ts#L153-L205) | `window.main.sync` |

> `insomnia-vcs` decouples the independently-testable VCS core — which could potentially be reused by the CLI (`insomnia-inso`) — from the renderer/main-process code. The main process's `new VCS(...)` call is made directly in `main/cloud-sync/vcs.ts`.

### `sync.invoke`: Reflective RPC Dispatched per Workspace

VCS instance methods **don't each get their own IPC channel** — they share a single `sync.invoke`, with `workspaceId` and the method name as the first two arguments:

```ts
// entry.preload.ts:153
const invokeSyncMethod = async <T>(workspaceId: string, methodName: string, ...args: unknown[]) => {
  try {
    return (await invokeWithNormalizedError('sync.invoke', workspaceId, methodName, ...args)) as T;
  } catch (error) {
    if (isUserAbortResolveMergeConflictError(error)) { /* restore the original error type */ }
    throw error;
  }
};

const sync: SyncBridgeAPI = {
  push: (workspaceId, ...args) => invokeSyncMethod(workspaceId, 'push', ...args),
  pull: (workspaceId, ...args) => invokeSyncMethod(workspaceId, 'pull', ...args),
  // …
};
```

The main process first looks up (or creates) the VCS instance for that `workspaceId`, then dispatches reflectively ([`main/cloud-sync/vcs.ts:76-110`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L76-L110)):

```ts
export const getVCSForWorkspace = (workspaceId: string): VCS => {
  ensureStoreConfigured();
  let vcs = vcsByWorkspaceId.get(workspaceId);
  if (!vcs) {
    vcs = new VCS({ workspaceId, conflictHandler: requestConflictResolution, testMode: !!PLAYWRIGHT_TEST });
    vcsByWorkspaceId.set(workspaceId, vcs);
  }
  return vcs;
};

export const invokeVCSForWorkspace = async (sender, workspaceId, methodName, ...args) => {
  const vcs = getVCSForWorkspace(workspaceId);
  const method = vcs[methodName as keyof VCS];
  if (typeof method !== 'function') throw new TypeError(`Unknown VCS method: ${methodName}`);
  return runWithSyncRenderer(sender, () => method.apply(vcs, args));
};
```

> `sync.invoke` is **reflective dispatch with no method allowlist** — the renderer can call any method by name on the `VCS` instance, including underscore-prefixed private methods like `_queryBlobs`, `_storeBranch`. It's constrained at the type level by `SyncBridgeMethods` ([`main/cloud-sync/ipc.ts:26-68`](../packages/insomnia/src/main/cloud-sync/ipc.ts#L26-L68)), but nothing intercepts it at runtime.

The 5 methods that never depend on a "currently active project" (`localBackendProjects`, `remoteBackendProjects`, `remoteBackendProjectsOfTeam`, `hasBackendProjectForRootDocument`, `removeBackendProjectsForRoot`) go through a separate channel, **`sync.invokeGlobal`**: no `workspaceId` needed, and no VCS instance involved at all — the main process looks the function up directly in a fixed method table (`GLOBAL_VCS_METHODS`), so this channel **is** allowlisted. At the type level this corresponds to `GlobalSyncBridgeMethods` ([`main/cloud-sync/ipc.ts:71-77`](../packages/insomnia/src/main/cloud-sync/ipc.ts#L71-L77)).

Two further exceptions: `sync.pullRemoteBackendProject`, and `sync.resolveConflict` / `sync.cancelConflict` (one-way `ipcRenderer.send`).

`window.main.sync`'s type declaration lives in [`main/ipc/main.ts:274`](../packages/insomnia/src/main/ipc/main.ts#L274), not in `global.d.ts`.

---

## Core Data Model

Defined in [`insomnia-vcs/src/types.ts`](../packages/insomnia-vcs/src/types.ts). Git Sync's `MergeConflict`/`AutoResolvedConflict` types are also defined here — the two sync implementations share the same merge-conflict types. Terminology maps onto Git fairly directly:

| Cloud Sync | Git analogue | Notes |
| --- | --- | --- |
| `BackendProject` | repository | `{ id, name, rootDocumentId }`, where `rootDocumentId` = the workspace's `_id` |
| `Branch` | branch | `{ name, created, modified, snapshots: string[] }` — **the snapshot list is a flat array, not a DAG** |
| `Snapshot` | commit | `{ id, parent, created, author, name, description, state[] }` |
| `SnapshotStateEntry` | tree entry | `{ key, blob, name }`, where `key` = the document's `_id` and `blob` = the content hash |
| `Blob` | blob | The normalized document as JSON |
| `Stage` | index | `Record<DocumentKey, StageEntry>` |
| `StatusCandidate` | working-tree file | `{ key, name, document }`, collected from NeDB by the renderer |
| `Status` | — | `{ stage, unstaged }` |
| `Head` | HEAD | `{ branch: string }` |

**The biggest structural difference from Git**: `Branch.snapshots` is a **flat, ordered array**. Finding the merge base isn't done by walking parent pointers to find an LCA — instead, [`getRootSnapshot()`](../packages/insomnia-vcs/src/util.ts#L400-L414) runs an O(n·m) **reverse double loop** over the two arrays to find the first element they share:

```ts
for (let ai = snapshotsA.length - 1; ai >= 0; ai--) {
  for (let bi = snapshotsB.length - 1; bi >= 0; bi--) {
    if (snapshotsA[ai] === snapshotsB[bi]) return snapshotsA[ai];
  }
}
```

The `Snapshot.parent` field exists, but is **only used to generate the ID** — it's never used to walk history.

> The `ResolutionSource` union type (`'choose' | 'manual'`) stays in `insomnia-vcs/src/types.ts`, but its runtime constant object, `RESOLUTION_SOURCE = { CHOOSE, MANUAL }`, lives in `packages/insomnia/src/sync/vcs/utils.ts` (see [Cross-Process Round Trip for Conflict Resolution](#cross-process-round-trip-for-conflict-resolution)) — because Git Sync's `git-vcs.ts` needs it too. The pure type lives in the cross-package-shared `insomnia-vcs`, while the constant, which is coupled to error types inside the insomnia package, stays there.

---

## Local Storage Layer

### Directory Layout

`FileSystemDriver.create(dataPath)` fixes the root directory at `<userData>/version-control` ([`store/drivers/file-system-driver.ts:15-18`](../packages/insomnia-vcs/src/store/drivers/file-system-driver.ts#L15-L18)):

```
version-control/
└── projects/
    └── <backendProjectId>/
        ├── meta.json                      BackendProject
        ├── head.json                      { branch: "master" }
        ├── branches/
        │   ├── master.json                Branch
        │   └── feat~my-branch.json        '/' → '~' (encodeBranchName)
        ├── snapshots/
        │   └── <sha1>.json                Snapshot
        └── blobs/
            └── ab/                        first 2 chars of blobId used as a shard dir
                └── cdef0123…              no extension → gzip compressed
```

### The Three-Layer Structure

```
VCS ──► getStore() ──► Store ──► BaseDriver
        (module-level    (serialize + hooks)   (FileSystemDriver / MemoryDriver)
         singleton)
```

The `VCS` class itself doesn't hold a `Store`/driver — every access calls `getStore()` from [`store/current-store.ts`](../packages/insomnia-vcs/src/store/current-store.ts). That's a module-level singleton: the host process calls `configureStore(driver)` once (passing `FileSystemDriver` in production, `MemoryDriver` in tests), and every `VCS` instance afterward shares that same `Store` — since a process only ever has one `dataPath`, and `Store` itself is a stateless pass-through wrapper (see below), sharing it introduces no cross-talk. [`Store`](../packages/insomnia-vcs/src/store/index.ts) handles JSON serialization and chains the hooks; `setItemRaw` / `getItemRaw` are the **direct pass-through that bypasses the hooks**.

### The Key Rule of the gzip Hook

[`store/hooks/compress.ts`](../packages/insomnia-vcs/src/store/hooks/compress.ts) only compresses keys that **have no extension**:

```ts
const write: HookFn = async (extension, value) => {
  if (extension) return value;      // .json stored as-is
  return gzip(value);               // blobs/xx/yyy compressed
};
```

So: `meta.json` / `head.json` / `branches/*.json` / `snapshots/*.json` are readable, pretty-printed JSON — **only blobs are gzipped**.

This rule interacts elegantly with the blob read/write paths:

| Method | Goes through the hook? | What you get |
| --- | --- | --- |
| `_getBlob` | ✅ read | gunzip + `JSON.parse` → a document object |
| `_storeBlobs` | ✅ write | plaintext → gzipped on disk |
| `_getBlobRaw` | ❌ `getItemRaw` | **raw gzip bytes** (fed straight into encryption for upload) |
| `_storeBlobsBuffer` | ❌ `setItemRaw` | decrypted gzip bytes written straight to disk |

In other words, **the compression layer sits just inside the encryption layer**: `doc → deterministicStringify → gzip → AES-GCM → upload`, and the download path is fully symmetric.

### Atomic Writes and Windows Compatibility

`setItem` first writes `<final>.<uuid>.tmp`, then renames it ([`store/drivers/file-system-driver.ts:35-52`](../packages/insomnia-vcs/src/store/drivers/file-system-driver.ts#L35-L52)). On Windows, antivirus software can lock a directory and cause `EACCES`/`EPERM`/`EBUSY`, so the rename goes through [`gracefulRename`](../packages/insomnia-vcs/src/store/drivers/graceful-rename.ts) — **retrying for up to 60 seconds**, with backoff capped at 100ms, and on the first failure it `stat`s the target to confirm it's a file before continuing to retry (borrowed from VS Code).

### Comparing Before Writing `meta.json`

`storeBackendProject` ([`backend-projects.ts:18-32`](../packages/insomnia-vcs/src/backend-projects.ts#L18-L32)) reads the old value first and does a deep comparison with `deterministicStringify`, skipping the disk write if the content is unchanged — this avoids a file write (and a file-watch storm) every time a workspace is activated. If the old file is corrupted (JSON parsing fails), the error is caught and it just overwrites normally. This is a top-level function independent of the `VCS` class, and doesn't depend on a "currently active project" — instance methods like `setBackendProject` call it internally.

---

## Content Addressing and Hash Normalization

Every change-detection check comes down to a single blob hash:

```ts
// insomnia-vcs/src/util.ts:467-493
export function hash(obj) {
  const content = deterministicStringify(obj);
  return { hash: crypto.createHash('sha1').update(content).digest('hex'), content };
}

export function hashDocument(doc) {
  const newDoc = clone(doc);
  if (newDoc) { models.deleteKeys(newDoc); models.resetKeys(newDoc); }
  return hash(newDoc);
}
```

The returned `content` is simultaneously **the exact bytes that will later be stored as the blob** — the hash and the content are computed in the same step, so the two can never drift apart.

### `deterministicStringify`

[`insomnia-data/common-src/deterministic-stringify.ts`](../packages/insomnia-data/common-src/deterministic-stringify.ts), 34 lines of recursion, exported from `insomnia-data/common` after compilation. It lives in `insomnia-data` so that `insomnia-vcs` can use it without depending back on `packages/insomnia`:

- Objects: `Object.keys().sort()`, then concatenated as `"k":v` pairs — **key order doesn't matter**.
- **A key whose value serializes to an empty string is dropped entirely** — so `undefined` is equivalent to "the key doesn't exist".
- Arrays: order is preserved, but empty-string elements are likewise dropped (so `[1, undefined, 2]` → `[1,2]`, changing the length — unlike `JSON.stringify`, which pads with `null`).
- Everything else: plain `JSON.stringify`. There's no circular-reference detection.

### `ignore-keys`: Cross-Machine Stability

[`insomnia-data/src/models/utils/ignore-keys.ts`](../packages/insomnia-data/src/models/utils/ignore-keys.ts) handles two kinds of fields that "shouldn't affect the hash", exported as `models.deleteKeys` / `models.resetKeys`:

| Operation | Field(s) | Reason |
| --- | --- | --- |
| `models.deleteKeys` — delete | `modified` | A local timestamp that changes on every write; otherwise every document would look "modified" |
| `models.resetKeys` — normalize to `null` | `Workspace.parentId`, `ProjectLintRuleset.parentId` | Points at a **local** Project's `_id`, which differs across machines/organizations |

Why "reset" rather than "delete"? The source comment explains it clearly: `deterministicStringify` drops `undefined` but keeps `null`, so removing a key that used to exist (even with a `null` value) would change the hash. Normalizing to a fixed default is what lets every client compute the same hash.

The cost: a workspace's `parentId` comes back as `null` after a pull, and has to be fixed before the delta is applied — see the patch in [`vcs.ts:613-618`](../packages/insomnia-vcs/src/vcs.ts#L613-L618) that calls itself a "hack", and the renderer's [`reparentSyncDelta`](../packages/insomnia/src/ui/sync-utils.ts#L74-L82).

These utilities live under `insomnia-data/src/models/` and are **reused by both Cloud Sync (`hashDocument`) and Git Sync** (in [`ne-db-client.ts`](../packages/insomnia/src/sync/git/ne-db-client.ts), via `models.resetKeys(doc)`).

### Snapshot ID

```ts
// insomnia-vcs/src/vcs.ts:1479-1488
function _generateSnapshotID(parentId, backendProjectId, state) {
  const hash = crypto.createHash('sha1').update(backendProjectId).update(parentId);
  for (const entry of [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1))) hash.update(entry.blob);
  return hash.digest('hex');
}
```

Determined purely by `(project ID, parent snapshot ID, content set)` — **it includes no commit message, timestamp, or author**. The first snapshot's parent is `EMPTY_HASH` (40 `0`s). The implication: two commits made against the same parent that produce identical content will get the same ID.

---

## Sync Candidate Set: Which Documents Get Synced

The renderer's [`getSyncItems({ workspaceId })`](../packages/insomnia/src/ui/sync-utils.ts#L65-L167) is the single source of the candidate set. It **doesn't query recursively** — instead it first flattens every descendant folder's id into one array, then does one `$in` query per document type:

```ts
const listOfParentIds = await flattenFoldersIntoList(activeWorkspace._id);
const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
// same for grpc / websocket / socket.io / requestGroup
```

Scope collected: Request / RequestGroup / GrpcRequest / WebSocketRequest / SocketIORequest / UnitTestSuite + UnitTest / MockServer + MockRoute / McpRequest / the base Environment + sub-Environments / ApiSpec / the Workspace itself, plus the **project-level** `ProjectLintRuleset` (parented under `workspace.parentId`, not a descendant of the workspace, so it has to be fetched separately).

Everything then goes through [`models.canSync`](../packages/insomnia-data/src/models/index.ts#L33-L45):

```ts
export function canSync(d: BaseModel) {
  if (d.isPrivate) return false;          // private documents are never synced
  return getModel(d.type)?.canSync || false;
}
```

The 18 models with `canSync = true`: `workspace`, `request`, `request-group`, `grpc-request`, `web-socket-request`, `socket-io-request`, `socket-io-payload`, `websocket-payload`, `mcp-request`, `environment`, `api-spec`, `mock-server`, `mock-route`, `unit-test`, `unit-test-suite`, `proto-file`, `proto-directory`, `project-lint-ruleset`.

Explicitly **not synced**: `cookie-jar`, every `*-meta`, `*-certificate`, `oauth-2-token`, `git-*`, `project`, `plugin-data`, `request-version`, `response`, `cloud-credential`, `mcp-payload/response`. In other words, **cookie jars, certificates, tokens, and every kind of local UI state never go to the cloud**.

The initialization path builds its candidate set a different way ([`initialize-backend-project.ts:31-42`](../packages/insomnia/src/sync/vcs/initialize-backend-project.ts#L31-L42)): `database.getWithDescendants(workspace)` + the lint ruleset, filtered through `canSync` the same way.

---

## Local Workflow: status → stage → takeSnapshot

### `status(candidates)`

[`vcs.ts:177-256`](../packages/insomnia-vcs/src/vcs.ts#L177-L256). The core is two steps:

1. [`applyStageToState(state, stage)`](../packages/insomnia-vcs/src/util.ts#L374-L399) layers "the latest snapshot's state" with "the current stage" into an **index state** — semantically equivalent to "the state you'd get if you committed the stage right now".
2. [`getStagable(indexState, candidates)`](../packages/insomnia-vcs/src/util.ts#L316-L373) takes the union of the index state and the current candidate set, compares key by key, gets the working tree's diff relative to the index, and routes it into `unstaged` per this table:

| Is the key staged? | Branch | Where `previousBlobContent` comes from |
| --- | --- | --- |
| Not staged | Index = HEAD, so `entry` is "HEAD vs working tree" | HEAD's blob (for `deleted`) or the corresponding blob (for added/modified) |
| Staged as `deleted` | The index no longer has this key at all — `getStagable` can only have produced an entry because the working tree added it back; if `entry` is itself also `deleted`, that's a contradictory state and it `throw`s | `null` |
| Staged as `added`/`modified` | The index holds the staged content for this key. Whether the working tree goes on to modify it further or delete it outright, the diff base is the same: "what's currently staged" | The stage entry's `blobContent` |

#### Correspondence with Git's `status` Semantics

Git's `git status` uses two different baselines: `staged` is index vs HEAD, and `unstaged` is working tree vs index. Insomnia computes the index state on the fly with `applyStageToState`, then consistently compares "working tree vs index" — so a case like "staged, then reverted back to the original content" is also handled correctly: as long as the working-tree content disagrees with the index, it shows up in `unstaged`; once they agree (including when the staged content already equals HEAD's — see `stage()` below), it stops showing as pending.

Unit tests for these scenarios are in [`vcs.test.ts`](../packages/insomnia-vcs/src/__tests__/vcs.test.ts), e.g. `can appear both staged and unstaged` starting at line 295.

### `stage(entries)`

[`vcs.ts:259-294`](../packages/insomnia-vcs/src/vcs.ts#L259-L294). Besides writing blobs and recording the stage, it also runs a **no-op check**:

```ts
const headBlobId = headStateMap[entry.key]?.blob;
const isNoOpAgainstHead = 'deleted' in entry ? headBlobId === undefined : entry.blobId === headBlobId;
if (isNoOpAgainstHead) {
  delete stage[entry.key];   // rather than writing stage[entry.key] = entry
  continue;
}
```

If the content being staged is actually identical to HEAD's (content reverted back to the original, or "deleting a key HEAD never had", i.e. "staged an add, then undid it"), the key is **removed** from the stage outright rather than recorded as a no-op entry. This is necessary because Insomnia's `stage` is a **sparse diff-from-HEAD map** (unlike Git's index, which is a complete tree) — the only way to express "no difference" is to have no entry at all for that key. Otherwise it would keep showing as "staged" and let `takeSnapshot()` commit a snapshot whose content hasn't actually changed.

1. **`blobContent` is only written to blob storage when it's actually needed to persist** (written for non-no-op `added`/`modified`; never written for `deleted`).
2. The entry is recorded into `this._stageByBackendProjectId[projectId]` (for a no-op, this instead means deleting the entry).

⚠️ **The stage lives purely in memory**. `_stageByBackendProjectId` ([`vcs.ts:111`](../packages/insomnia-vcs/src/vcs.ts#L111)) is an ordinary object on the VCS instance and is never persisted to disk. After an app restart the staged list is empty (the blob content is still on disk, but is now orphaned), requiring a fresh `status` + `stage`.

### `takeSnapshot(name)`

[`vcs.ts:559-584`](../packages/insomnia-vcs/src/vcs.ts#L559-L584):

```
new state = applyStageToState(parent snapshot's state, stage)
          = (every entry in the parent snapshot's state that isn't staged) ∪ (every non-deleted entry in the stage)
```

`status()` and `takeSnapshot()` share the exact same [`applyStageToState`](../packages/insomnia-vcs/src/util.ts#L374-L399) implementation to compute the index state — there's no place where this logic is written twice.

An empty stage or an empty message throws immediately. `_createSnapshotFromState` then generates the ID, appends it to `branch.snapshots`, persists the branch and snapshot to disk, and finally **clears the stage**.

`author` is left as an empty string at this point, and gets backfilled with the current `accountId` at push time ([`vcs.ts:950-956`](../packages/insomnia-vcs/src/vcs.ts#L950-L956)) — this is what lets commits be made while offline and logged out.

---

## Remote Workflow: push / pull / fetch

### `push({ teamId, teamProjectId })`

[`vcs.ts:650-688`](../packages/insomnia-vcs/src/vcs.ts#L650-L688):

1. `_getOrCreateRemoteBackendProject` — creates the remote project if it doesn't exist (triggering key generation, see [Encryption Model](#encryption-model)).
2. **Linear history check**: compares the remote's `branch.snapshots[i]` against the local `branch.snapshots[i]` position by position, throwing `Remote history conflict. Please pull latest changes and try again` at the first mismatch. Equivalent to requiring that "local history must be a prefix extension of remote history" — **it will never force-push**.
3. Takes `snapshots.slice(lastMatchingIndex)`; throws `Already up to date` if that's empty.
4. Gathers every blobId referenced by these snapshots, and asks the server which ones are missing via `blobsMissing`.
5. `_queryPushBlobs(missing)` — reads each one with `_getBlobRaw` (gzip bytes) → AES-GCM encrypts → batches them, firing a `blobsCreate` **every 2MB or 200 items, whichever comes first**.
6. `_queryPushSnapshots` — `snapshotsCreate` in batches of 20, writing the response back locally (the server may have filled in fields like `authorAccount`).

### `pull({ candidates, teamId, teamProjectId, projectId })`

[`vcs.ts:586-621`](../packages/insomnia-vcs/src/vcs.ts#L586-L621) is implemented rather cleverly — **pull works by fetching the remote into a temporary local branch, then merging it in**:

```ts
const localBranch = await this._getCurrentBranch();
const tmpBranchForRemote = await this.customFetch(localBranch.name + '.hidden', localBranch.name);
const delta = await this._merge(candidates, localBranch.name, tmpBranchForRemote.name,
                                `Synced latest changes from ${localBranch.name}`,
                                true /* useOtherBranchHistory */);
await this._removeBranch(tmpBranchForRemote);
```

`useOtherBranchHistory = true` is the key part: after merging, **the local branch adopts the remote's snapshot array directly**, then appends the merge result on top. This keeps local history as a permanent prefix extension of remote history, so the next push is guaranteed to pass the linear check in step 2.

The `.hidden` suffix also gets used to prettify the conflict modal's labels ([`vcs.ts:801-803`](../packages/insomnia-vcs/src/vcs.ts#L801-L803)): when a branch name is detected to contain `.hidden`, the labels show as `master local` vs `master remote` instead of `master` vs `master.hidden`.

The returned `Operation { upsert, remove }` is applied to NeDB by the renderer via `database.batchModifyDocs`.

### `customFetch(localBranchName, remoteBranchName)`

[`vcs.ts:690-736`](../packages/insomnia-vcs/src/vcs.ts#L690-L736). It only fetches what's missing locally:

1. Walks the remote branch's snapshot IDs, adding any not found locally to `snapshotsToFetch`.
2. `_querySnapshots` (batches of 20) fetches the snapshots.
3. Walks those snapshots' state entries, adding any where `_hasBlob` is false to `blobsToFetch`.
4. `_queryBlobs` (batches of 50) fetches the blobs → unwraps the project symmetric key via RSA → AES-GCM decrypts → `_storeBlobsBuffer` writes them straight to disk (still gzipped).
5. Clones the remote branch object, renames it, refreshes its timestamp, and persists it.

---

## Merge Algorithm

`_merge(candidates, trunk, other, message?, useOtherBranchHistory?)` ([`vcs.ts:738-828`](../packages/insomnia-vcs/src/vcs.ts#L738-L828)) decides in this order:

```
preMergeCheck(trunkState, otherState, candidates)
  ├─ conflicts non-empty → throw 'please commit or revert current changes first'
  └─ dirty[] (safe uncommitted local changes, filtered out of the delta at the end so they're kept)

if (other's latest snapshot === the common ancestor) || (other has no snapshots)     → do nothing
else if (common ancestor === trunk's latest snapshot) || (trunk has no snapshots)    → fast-forward: trunk.snapshots = other.snapshots
else                                                                                  → three-way merge
```

### `preMergeCheck`

[`util.ts:416-464`](../packages/insomnia-vcs/src/util.ts#L416-L464) sorts every working-tree candidate into three buckets:

| Case | Bucket |
| --- | --- |
| Neither trunk nor other has this key | **dirty** (a brand-new local document — keep it) |
| Candidate's hash == trunk's | Clean, ignore |
| Candidate's hash == other's | Clean (will end up the same value after merging), ignore |
| trunk == other but the candidate differs | **dirty** (a safe local change — keep it) |
| Everything else | **conflict** → abort the merge |

Documents classified as `dirty` are ultimately filtered out of the returned delta ([`vcs.ts:926-929`](../packages/insomnia-vcs/src/vcs.ts#L926-L929)), so a user's uncommitted local edits never get overwritten by the merge result.

### `threeWayMerge`

[`util.ts:67-240`](../packages/insomnia-vcs/src/util.ts#L67-L240) **explicitly expands all 12 combinations** of `(root, trunk, other)` (the source comment states plainly that this could be simplified, but every case is spelled out to stay as bulletproof and readable as possible):

| # | Case | Result |
| --- | --- | --- |
| 1 | All three identical | Keep trunk |
| 2 | Both deleted | Delete |
| 3 | trunk deleted, other unchanged | Delete |
| 4 | other deleted, trunk unchanged | Delete |
| 5 | Both added | Hashes differ → **conflict** (defaults to other) |
| 6 | Only trunk added | Keep trunk |
| 7 | Only other added | Take other |
| 8 | Both modified | Hashes differ → **conflict** (defaults to other) |
| 9 | Only trunk modified | Keep trunk |
| 10 | Only other modified | Take other |
| 11 | trunk deleted, other modified | **Conflict** (defaults to other, i.e. "resurrect it") |
| 12 | other deleted, trunk modified | **Conflict** (defaults to trunk, i.e. "keep it") |
| — | Fallback | `throw new Error('3-way merge hit impossible state')` |

Note that every default `choose` value leans toward **preserving data** rather than discarding it: cases 11/12 both default to keeping the side that was modified.

Once conflicts arise, `_merge` first reads the **actual document content** for `mineBlob`/`theirsBlob` and attaches it to the conflict object (so the UI can render a diff), then hands it to `conflictHandler`, and finally applies the user's choices with [`updateStateWithConflictResolutions`](../packages/insomnia-vcs/src/util.ts#L495-L525) (`choose === null` means delete that entry).

### `checkout` / `rollback`

Both are built on [`stateDelta(base, desired)`](../packages/insomnia-vcs/src/util.ts#L284-L315), which produces `{ add, update, remove }`, converted into a `{ upsert, remove }` array of documents handed to the renderer to write to the database. `checkout` ([`vcs.ts:394-424`](../packages/insomnia-vcs/src/vcs.ts#L394-L424)) likewise runs `preMergeCheck` first, refusing to switch branches on conflict (`Please commit current changes before switching branches`), and strips `dirty` entries out of the delta to preserve local changes. `rollback` / `rollbackToLatest` are at [`vcs.ts:454-500`](../packages/insomnia-vcs/src/vcs.ts#L454-L500).

---

## Cross-Process Round Trip for Conflict Resolution

The VCS runs in the main process, the conflict modal lives in the renderer, and `_merge` is an `await` that must **synchronously wait on a user decision**. The solution is `AsyncLocalStorage` plus a table of pending promises ([`main/cloud-sync/vcs.ts`](../packages/insomnia/src/main/cloud-sync/vcs.ts)):

```
Renderer process                        Main process
─────────────────                       ────────────
sync.invoke(workspaceId, 'merge', …)
   ├──────────────────────────────►  getVCSForWorkspace(workspaceId) → vcs
                                      runWithSyncRenderer(sender, () => vcs.merge(…))
   │                                   syncInvocationContext.run({ sender }, …)
   │                                        │
   │                                   _merge → handleAnyConflicts → conflictHandler
   │                                        │
   │                                   requestConflictResolution(conflicts, labels)
   │                                     handlerId = randomUUID()
   │                                     context.sender.send('sync.merge-conflicts', {…})
   │ ◄─────────────────────────────       return new Promise(...)  ← merge suspends here
   │                                       pendingConflictResolutions.set(handlerId, {senderId, resolve, reject})
   │
 SyncMergeModal opens
   │
   │ sync.resolveConflict({handlerId, conflicts})
   ├──────────────────────────────►  checks senderId matches → resolve(conflicts)
   │                                   merge resumes, produces the merge snapshot
   │ ◄─────────────────────────────   returns the Operation delta
```

Key points:

- `AsyncLocalStorage` guarantees that a nested `_merge` call can get hold of **the `WebContents` that initiated this call**, without having to thread `sender` through every layer.
- `pendingConflictResolutions` records the `senderId`; `resolvePendingSyncConflict` / `cancelPendingSyncConflict` verify the reply comes from the same renderer ([`main/cloud-sync/vcs.ts:134-164`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L134-L164)), preventing cross-window interference.
- The cancel path rejects with a `UserAbortResolveMergeConflictError`. Both this error class and the `RESOLUTION_SOURCE` constant are defined in [`sync/vcs/utils.ts`](../packages/insomnia/src/sync/vcs/utils.ts). IPC serialization loses the prototype chain, so preload reconstructs this error type by `name` in [`entry.preload.ts:157-161`](../packages/insomnia/src/entry.preload.ts#L157-L161), and the branch/merge routes silently swallow it accordingly (a user-initiated cancel doesn't count as a failure).
- The renderer's listener registers only once (a module-level `hasRegisteredConflictListener` boolean, [`ui/utils/insomnia-sync.ts:6-15`](../packages/insomnia/src/ui/utils/insomnia-sync.ts#L6-L15)), called at `entry.client.tsx` startup.
- Closing the modal any way (Esc / clicking the overlay) goes through `onOpenChange` → `onCancelUnresolved`, so the main process's Promise is never left hanging.

`SyncMergeModal` is a component **shared** by Cloud Sync and Git Sync, differing by `editorType`: Cloud Sync defaults to `'diff'` (pick one side), Git Sync uses `'merge'` (manual editing), corresponding to `resolutionSource`'s `CHOOSE` / `MANUAL`. Its `MergeConflict` type is imported from `insomnia-vcs`; the `RESOLUTION_SOURCE` constant is imported from `~/sync/vcs/utils`.

---

## Encryption Model

Cloud Sync is **end-to-end encrypted**: the server only ever sees ciphertext blobs — never the request URL, headers, or script content.

### Key Hierarchy

```
User's RSA key pair (RSA-OAEP-256)
  ├─ publicKey  (JWK, stored plaintext in UserSession)
  └─ encPrivateKey ──[AES-GCM, decrypted with the session symmetricKey]──► privateKey (JWK)
                                  │
                                  ▼
        One AES-256-GCM symmetricKey per BackendProject
          Generated client-side when the project is created, wrapped once per
          **each team member's RSA public key**
          → projectCreate(teamKeys: [{accountId, encSymmetricKey, autoLinked}])
                                  │
                                  ▼
                     Blob content: AES-256-GCM(gzip(normalized JSON))
```

### Generating and Distributing the Project Key

When creating a remote project ([`_queryCreateProject`, vcs.ts:1174-1244](../packages/insomnia-vcs/src/vcs.ts#L1174-L1244)):

```ts
const symmetricKey = await generateAES256KeyInNode();     // WebCrypto AES-GCM/256, exported as JWK
const symmetricKeyStr = JSON.stringify(symmetricKey);

for (const { accountId, publicKey, autoLinked } of teamPublicKeys || []) {
  teamKeys.push({ accountId, autoLinked,
    encSymmetricKey: crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKeyStr) });
}
```

Member public keys come from the `teamMemberKeys(teamId)` query. `generateAES256KeyInNode` ([`vcs.ts:60-83`](../packages/insomnia-vcs/src/vcs.ts#L60-L83)) prefers `crypto.webcrypto.subtle`, falling back to `crypto.randomBytes(32)`.

It's unwrapped in the reverse direction when used ([`_getBackendProjectSymmetricKey`, vcs.ts:1251-1262](../packages/insomnia-vcs/src/vcs.ts#L1251-L1262)):

```ts
const encSymmetricKey = await this._queryBackendProjectKey();      // projectKey(projectId)
const symmetricKeyStr = crypt.decryptRSAWithJWK(privateKey, encSymmetricKey);
return JSON.parse(symmetricKeyStr);
```

> ⚠️ Under Playwright E2E tests this short-circuits and uses the session symmetric key directly ([`vcs.ts:1254-1257`](../packages/insomnia-vcs/src/vcs.ts#L1254-L1257)). Whether test mode is active is decided by the constructor option `testMode`; the main process passes `testMode: !!PLAYWRIGHT_TEST` when creating a workspace's VCS instance ([`main/cloud-sync/vcs.ts:81-85`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L81-L85)) — the `insomnia-vcs` package itself has no dependency on `packages/insomnia`'s `PLAYWRIGHT_TEST` constant; test mode is injected entirely from the caller via the constructor argument.

### Primitives

All in [`insomnia-vcs/src/crypt.ts`](../packages/insomnia-vcs/src/crypt.ts), built on **node-forge** (pure JS) — only key generation uses WebCrypto. `packages/insomnia/src/common/account/crypt.ts` is a pure re-export file:

```ts
// packages/insomnia/src/common/account/crypt.ts
export {
  encryptRSAWithJWK, decryptRSAWithJWK, encryptAESBuffer,
  encryptAES, decryptAES, decryptAESToBuffer, generateAES256Key,
} from 'insomnia-vcs';
```

This means call sites in the renderer that import these functions via `~/common/account/crypt` (e.g. the key-pair generation code in the login flow) don't need to change. node-forge is only a dependency of the `insomnia-vcs` package — `packages/insomnia` doesn't depend on it directly.

| Function | Algorithm | Notes |
| --- | --- | --- |
| `encryptAESBuffer` | AES-256-GCM, 12-byte random IV, 128-bit tag | Encrypts bytes directly, **no URI encoding** (unlike `encryptAES`) |
| `decryptAESToBuffer` | Same | Tag length is derived from the ciphertext: `tagLength: encryptedResult.t.length * 4` |
| `encryptRSAWithJWK` | RSA-OAEP + SHA-256 | Enforces `alg === 'RSA-OAEP-256'`; `encodeURIComponent`s first, outputs hex |
| `decryptRSAWithJWK` | Same | Needs the full CRT private key (`n,e,d,p,q,dp,dq,qi`) |

The AES ciphertext's on-the-wire format (`AESMessage`, all lowercase hex):

```json
{ "iv": "…12 bytes…", "t": "…16-byte tag…", "ad": "", "d": "…ciphertext…" }
```

When a blob is uploaded, it's `JSON.stringify(encryptedResult, null, 2)`'d and sent as the GraphQL `content` field.

### The Full Blob Pipeline

```
Outbound: BaseModel
       → clone + models.deleteKeys(modified) + models.resetKeys(parentId)
       → deterministicStringify                     ← blobId = sha1(this step's output)
       → Buffer(utf8)                               ← _storeBlobs
       → gzip                                       ← compress hook (no extension)
       ═══ persisted to disk at version-control/projects/…/blobs/xx/yyy ═══
       → AES-256-GCM(project symmetric key)          ← _queryPushBlobs
       → JSON.stringify({iv,t,ad,d})
       → GraphQL blobsCreate

Inbound: fully symmetric (_queryBlobs decrypts → _storeBlobsBuffer writes the raw gzip bytes → _getBlob goes through the hook to decompress + parse)
```

### Security Boundary Notes

End-to-end encryption holds **relative to the server** — local disk is not encrypted:

- Blobs under `version-control/` are only gzipped, never encrypted.
- The session symmetric key, `symmetricKey`, is stored as a **plaintext JWK** in the local NeDB `UserSession` document ([`insomnia-data/src/models/user-session.ts`](../packages/insomnia-data/src/models/user-session.ts)); `encPrivateKey` is only encrypted relative to it. In other words, having the local NeDB file is enough to recover the RSA private key. Electron `safeStorage` is **not used** here (`safeStorage` is only used elsewhere, in [`main/ipc/secret-storage.ts`](../packages/insomnia/src/main/ipc/secret-storage.ts)).
- `assertSession()` / `getPrivateKey()` ([`session.ts:8-39`](../packages/insomnia-vcs/src/session.ts#L8-L39), top-level functions independent of the `VCS` class) re-read the database on every call (`services.userSession.get()`, from `insomnia-data`) and decrypt with `crypt.decryptAES` — **there's no caching**.

---

## Network Layer and GraphQL Contract

### Transport

[`runVcsGraphQL`](../packages/insomnia-api/src/vcs.ts) is a very thin wrapper:

```ts
return fetch({ method: 'POST', path: '/graphql?' + name, data: { query, variables }, sessionId });
```

The operation name is appended to the query string (`/graphql?blobsCreate`) **purely for observability** — the server doesn't depend on it.

Underneath is [`insomniaFetch`](../packages/insomnia/src/common/insomnia-fetch.ts):

- **Base URL**: `env.INSOMNIA_API_URL || 'https://api.insomnia.rest'`
- **Auth header**: `X-Session-Id: <sessionId>`, plus `X-Insomnia-Client`, `insomnia-request-id`, `X-Origin`
- **Timeout**: `AbortSignal.timeout(30_000)`
- **Retries**: **none**. The `retries` parameter is accepted but entirely ignored (the source has a `// It's not used at all, should be removed?` comment)
- The main process uses Electron's `net.fetch`, so it goes through the system proxy and system certificates

Errors are handled at two layers: a non-2xx HTTP status throws `ResponseFailError`; an HTTP 200 with a non-empty GraphQL `errors[]` is handled by the generic `runGraphQL` ([`session.ts:41-60`](../packages/insomnia-vcs/src/session.ts#L41-L60), called by every `_query*` method on the `VCS` class):

```ts
if (errors?.length) throw new Error(`Failed to query ${name}: ${errors[0].message}`);
if (data == null)   throw new Error(`Failed to query ${name}: no data returned`);
```

Errors containing `invalid access` get rewritten into a user-readable permission message by [`interceptAccessError`](../packages/insomnia/src/sync/access-error.ts).

### The Full Set of GraphQL Operations

Queries:

| Operation | Variables | Returns | Call site |
| --- | --- | --- | --- |
| `projects` | `teamId`, `teamProjectId` \| `allProjects` | `[{id,name,rootDocumentId,teamProjectId,teams}]` | `remoteBackendProjects` / `…OfTeam` (`backend-projects.ts`, doesn't depend on a `VCS` instance) |
| `project` | `id` | `{id,name,rootDocumentId}` \| `null` | `_queryProject` (`vcs.ts`) |
| `branches` | `project` | `[{name}]` | `getRemoteBranchNames` |
| `branch` | `project`, `name` | `{created,modified,name,snapshots}` | `_queryBranch` |
| `snapshots` | `ids`, `project` | Full snapshots + `authorAccount` | `_querySnapshots` (batches of 20) |
| `blobs` | `ids`, `project` | `[{id, content}]`, `content` is encrypted JSON | `_queryBlobs` (batches of 50) |
| `blobsMissing` | `project`, `ids` | `{missing:[id]}` | Asked before pushing |
| `projectKey` | `projectId` | `{encSymmetricKey}` | Fetching the project symmetric key |
| `teamMemberKeys` | `teamId` | `{memberKeys:[{accountId,publicKey,autoLinked}]}` | Distributing keys when creating a project |

The remaining call sites are all in `insomnia-vcs/src/vcs.ts`, as `VCS` instance methods.

Mutations:

| Operation | Variables | Returns |
| --- | --- | --- |
| `projectCreate` | `name,id,rootDocumentId,teamId,teamProjectId,teamKeys` | `{id,name,rootDocumentId}` |
| `projectArchive` | `id` | `Boolean` |
| `branchRemove` | `project`, `name` | `Boolean` |
| `snapshotsCreate` | `project`, `snapshots`, `branch` | The created snapshots, echoed back |
| `blobsCreate` | `project`, `blobs` | `{count}` |

> The executable reference for the server-side contract lives in [`packages/insomnia-smoke-test/server/cloud-sync-api.ts`](../packages/insomnia-smoke-test/server/cloud-sync-api.ts) — it implements the same AES-GCM format with Node's native `crypto` and does a full decrypt → gunzip round trip, so it can be treated as the authoritative reference for the wire format.

### Batching and Chunking Strategy

| Operation | Chunk size |
| --- | --- |
| `_querySnapshots` / `_queryPushSnapshots` | Batches of 20 |
| `_queryBlobs` | Batches of 50 |
| `_queryPushBlobs` | **2 MB or 200 items**, whichever comes first |

There's no concurrency control — every batch is sent serially.

---

## Lifecycle: Initialization, Pull, Deletion

### Setting Up Sync for a Workspace the First Time

[`initializeLocalBackendProjectAndMarkForSync`](../packages/insomnia/src/sync/vcs/initialize-backend-project.ts#L16-L53):

```
switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name)
  → locally generates a BackendProject { id: generateId('prj'), rootDocumentId: workspace._id }
candidate set = getWithDescendants(workspace) + projectLintRuleset, filtered through canSync
status → stage(everything unstaged) → takeSnapshot('Initial Snapshot')
workspaceMeta.pushSnapshotOnInitialize = true
```

The `SyncVCSLike` interface in this file imports the `Stage`/`StageEntry`/`Status`/`StatusCandidate` types from `insomnia-vcs`, and takes no `workspaceId` parameter — it describes the shape a "vcs handle already bound to some workspace" should have. The main process passes a real `VCS` instance directly (`getVCSForWorkspace(workspaceId)`); the renderer, since every method on `window.main.sync` now requires an explicit `workspaceId`, wraps it with an adapter, [`syncVCSLikeForWorkspace(workspaceId)`](../packages/insomnia/src/ui/sync-utils.ts#L57-L67), which binds the `workspaceId` before handing it to these two functions.

Note that at this point **only the local project is created — the network is never touched**. The actual remote project isn't created until the first push (`_getOrCreateRemoteBackendProject`).

`pushSnapshotOnInitialize` then runs the push and clears the flag, once "the project is the workspace's parent, the project has a `remoteId`, and the VCS has an active project" all hold. There's a comment here explaining why it checks `hasBackendProject()` — historically, a React key change in App.tsx could cause this code path to run twice.

The two main-process entry points ([`initialization.ts`](../packages/insomnia/src/main/cloud-sync/initialization.ts)) both use `getVCSForWorkspace(workspaceId)` to get that workspace's own VCS instance:

- `initializeWorkspaceBackendProject` — returns immediately if not logged in; **skips if `workspaceMeta.gitRepositoryId` is set** (Git Sync takes priority).
- `syncNewWorkspaceIfNeeded` — used for scenarios like import. Additionally checks `models.project.isRemoteProject(project)` and the organization's [`storageRules.enableCloudSync`](../packages/insomnia/src/common/organization-storage-rules.ts) (always `false` for the Scratchpad organization). On failure it only `console.warn`s, leaving a retry for the next time the workspace is opened.

### Pulling an Existing Remote Collection

[`pullRemoteBackendProject`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L166-L202) → [`pullBackendProject`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts):

```
remoteBackendProjects(...)  ← a top-level function, no VCS instance involved, queries the remote project list
removeBackendProjectsForRoot(rootDocumentId)  ← a top-level function, cleans up any stale local project(s) sharing this root
getVCSForWorkspace(rootDocumentId)  ← rootDocumentId is exactly the target workspace's id, so this gets its own VCS instance
setBackendProject → checkout([], 'master') → getRemoteBranchNames
  ├─ remote has no master → just create an empty workspace shell locally
  └─ has master → pull([]) → allDocuments() written to the database one by one
       · Workspace.parentId  → the local project's ._id
       · ProjectLintRuleset.parentId → the local project's ._id
       · wrapped in bufferChanges / flushChanges to avoid triggering UI revalidation per document
```

The `VCS`, `BackendProjectWithTeam`, and other types are imported from `insomnia-vcs`. Because this gets "this workspace's own" VCS instance (rather than one shared with other workspaces), this pull can never interfere with concurrent `sync.invoke` calls targeting other workspaces.

### Deletion

[`workspace.delete.tsx`](../packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.delete.tsx) first calls `switchAndCreateBackendProjectIfNotExist`, using `workspace._id` as both the `workspaceId` and the `rootDocumentId`, to locate the project. Then:

- Local project → `removeBackendProjectsForRoot(rootDocumentId)` (goes through `sync.invokeGlobal`, needs no `workspaceId`, only deletes the local `meta.json`)
- Remote project → `archiveProject(workspaceId)` (the `projectArchive` mutation + deleting the local meta + clearing that VCS instance's `_backendProject`)

---

## Renderer Process Integration

### Route Table

Every Cloud Sync operation is a flat-file route's `clientAction`/`clientLoader` (`src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.*.tsx`); the `workspaceId` from the route params gets passed through as the first argument to `window.main.sync.<method>(workspaceId, ...)`:

| Route | VCS method(s) called |
| --- | --- |
| `insomnia-sync` | `localBackendProjects`, `remoteBackendProjects` → the list of pullable projects |
| `insomnia-sync/sync-data` | loader: `getBranchNames`, `getCurrentBranchName`, `getHistory`, `getHistoryCount`, `status`, `getRemoteBranchNames`, `compareRemoteBranch`, `remoteBackendProjects`; and writes back `workspaceMeta.{hasUncommittedChanges,hasUnpushedChanges}` |
| `insomnia-sync/push` | `push` |
| `insomnia-sync/pull` | `pull` + `batchModifyDocs(reparentSyncDelta(delta))` |
| `insomnia-sync/create-snapshot` | `takeSnapshot`, optionally immediately followed by `push` |
| `insomnia-sync/stage` · `/unstage` | `status` → `stage` / `unstage` |
| `insomnia-sync/rollback` · `/restore` | `rollbackToLatest` / `rollback(id)` + `batchModifyDocs` |
| `insomnia-sync/fetch` | `checkout` → `pull([])` → on failure, `checkout` back to the original branch |
| `insomnia-sync/branch/checkout` · `/create` · `/merge` · `/delete` | `checkout` / `fork`+`checkout` / `merge` / `removeRemoteBranch`+`removeBranch` |
| `/organization/:id/insomnia-sync/pull-remote-file` | `pullRemoteBackendProject` |

**Every route that produces a delta must call [`reparentSyncDelta`](../packages/insomnia/src/ui/sync-utils.ts#L74-L82) before `batchModifyDocs`**, or `ProjectLintRuleset` ends up written to the database with `parentId: null`.

There are two more call sites outside `insomnia-sync/*`: the workspace root route's loader (`switchAndCreateBackendProjectIfNotExist` + `pushSnapshotOnInitialize` + `getVersion`), and the workspace deletion route (`switchAndCreateBackendProjectIfNotExist` + `removeBackendProjectsForRoot`/`archiveProject`). The former needs to adapt `window.main.sync` into the `SyncVCSLike` shape (which takes no `workspaceId` parameter) when calling `pushSnapshotOnInitialize`, using [`syncVCSLikeForWorkspace(workspaceId)`](../packages/insomnia/src/ui/sync-utils.ts#L57-L67) (also used by `updateLocalProjectToRemote` in `ui/organization-utils.ts` when batch-initializing multiple workspaces — one bound instance per workspace). The latter calls `window.main.sync`'s `workspaceId`-taking methods directly, without going through `SyncVCSLike`.

### UI and Refresh Cadence

- [`sync-bar.tsx`](../packages/insomnia/src/ui/components/sidebar/sync-bar.tsx) is a pure dispatcher; [`workspace-sync-dropdown.tsx`](../packages/insomnia/src/ui/components/dropdowns/workspace-sync-dropdown.tsx) only renders Cloud Sync's [`sync-dropdown.tsx`](../packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx) when `isRemoteProject(project) && !workspaceMeta.gitRepositoryId`.
- **Polling**: `useInterval(triggerSync, isWindowFocused ? 60_000 : null)` — refreshes remote state once a minute while the window is focused, pausing when it loses focus; regaining focus (`mainWindowFocusChange`) also triggers a refresh.
- **Event-driven**: [`insomnia-event-stream-context.tsx`](../packages/insomnia/src/ui/context/app/insomnia-event-stream-context.tsx) immediately re-submits the sync-data action on receiving an SSE `FileChanged` / `BranchDeleted` — a second refresh path alongside polling.
- **Module-level caches**: `remoteBranchesCache` / `remoteCompareCache` / `remoteBackendProjectsCache` ([`ui/sync-utils.ts:47-49`](../packages/insomnia/src/ui/sync-utils.ts#L47-L49)), explicitly invalidated by each action.
- Badges: `pullCount = compare.behind` / `pushCount = compare.ahead`, where `compare` comes from [`compareBranches`](../packages/insomnia-vcs/src/util.ts#L241-L283) (also based on the common ancestor's index in the two arrays).

---

## Known Issues and Design Debt

Ordered roughly by impact; all of these are facts derived from reading the code, without runtime verification:

1. **The stage isn't persisted.** `_stageByBackendProjectId` ([`vcs.ts:111`](../packages/insomnia-vcs/src/vcs.ts#L111)) is a plain in-memory object, lost on every app restart. Blobs that were already written become orphaned files nobody references, with no GC mechanism. It's keyed by `backendProjectId` rather than `workspaceId` — a given `workspaceId` can correspond to more than one `backendProjectId` over its lifetime (see the "clean up inactive duplicate projects" logic in [`backend-projects.ts`](../packages/insomnia-vcs/src/backend-projects.ts)), so it can't simply be re-keyed by `workspaceId`.

2. **Branch filenames are case-asymmetric.** The `_storeBranch` write path applies `.toLowerCase()`, while `_getBranch` / `_removeBranch` don't ([`vcs.ts:1384` / `:1308` / `:1399`](../packages/insomnia-vcs/src/vcs.ts#L1384)). On case-sensitive filesystems (Linux, some macOS configurations), a branch name written with uppercase letters can't be read back. The source itself leaves a comment: `// toLowerCase may introduce issues under case sensitive filesystems`.

3. **`Workspace.parentId` needs a fix in two places once it's reset to null.** The main process's `pull` has a patch that calls itself a hack ([`vcs.ts:613-618`](../packages/insomnia-vcs/src/vcs.ts#L613-L618), `// …this is a hack to restore those parentIds until we have a chance to redesign vcs`), and the renderer has to run `reparentSyncDelta` again to handle `ProjectLintRuleset`. Any newly added model with an "unstable parent" would need both of these updated together.

4. **The VCS instance pool has no eviction policy.** `vcsByWorkspaceId` ([`main/cloud-sync/vcs.ts:45`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L45)) only ever grows — it accumulates one `VCS` instance for every workspace opened during the process's lifetime, and neither deleting a workspace nor closing a window removes its entry. Each instance is quite light (it holds no Store, only a handful of fields — `_backendProject`/`_stageByBackendProjectId`/`workspaceId`), so this typically isn't an issue within a single session.

5. **`decryptAESToBuffer`'s tag length comes from the ciphertext.** `tagLength: encryptedResult.t.length * 4` — if a blob's origin isn't trusted, the authentication strength can be influenced externally. Implemented in [`insomnia-vcs/src/crypt.ts`](../packages/insomnia-vcs/src/crypt.ts).

6. **No retries, no backoff.** After the 30-second timeout, the entire push/pull fails and the user has to retry manually. A large collection's first push has to send many batches serially, and a dropped connection midway means starting over (though `blobsMissing` lets a retry skip blobs already uploaded, keeping the retry cost reasonable).

7. **`getRootSnapshot` is O(n·m).** Merging long-history branches grows quadratically with snapshot count. Implemented at [`insomnia-vcs/src/util.ts:400-414`](../packages/insomnia-vcs/src/util.ts#L400-L414).

8. **`sync.invoke` has no method allowlist.** It reflectively dispatches to any method on the `VCS` instance, with no runtime interception (`sync.invokeGlobal` is the exception — it only forwards to a fixed method table). See [Process Layering](#syncinvoke-reflective-rpc-dispatched-per-workspace).

9. **Dead code**: [`src/sync/delta/`](../packages/insomnia/src/sync/delta/) (`diff.ts` / `patch.ts`) has no references anywhere in the repo.

10. **A few leftover TODOs**: at the top of `vcs.ts` ([`insomnia-vcs/src/vcs.ts:1-3`](../packages/insomnia-vcs/src/vcs.ts#L1-L3)), `Rename things that run a fetch to fetchSomething...` / `Make sure that pull handles updating the parentId to the current project._id`; the line after `checkout`, `// rename preMergeCheck to instance getCandidateStatus` ([`vcs.ts:426`](../packages/insomnia-vcs/src/vcs.ts#L426)), hinting at a future move of `preMergeCheck` from a standalone function to an instance method; and in `session.ts`, above `getPrivateKey`, `// TODO: This is a temporary solution to get the private key from the session.` ([`session.ts:7`](../packages/insomnia-vcs/src/session.ts#L7)), hinting that this private-key-decryption logic hasn't found a permanent home yet.

---

## Testing

| Layer | File | Coverage |
| --- | --- | --- |
| Pure algorithms | [`insomnia-vcs/src/__tests__/util.test.ts`](../packages/insomnia-vcs/src/__tests__/util.test.ts) (1006 lines) | All 12 branches of `threeWayMerge`, `stateDelta`, `getStagable`, `preMergeCheck`, `compareBranches`, `hash`/`hashDocument` |
| VCS | [`insomnia-vcs/src/__tests__/vcs.test.ts`](../packages/insomnia-vcs/src/__tests__/vcs.test.ts) (1139 lines) | `status`/`stage`/`takeSnapshot` (including edge cases like staging a revert, staging a deletion), `fork`/`merge`/`getHistory`/branch-name validation. Uses `configureStore(new MemoryDriver())` to set up the shared Store, and mocks `generateId` within the file to pin snapshot hashes |
| Project directory | [`insomnia-vcs/src/__tests__/backend-projects.test.ts`](../packages/insomnia-vcs/src/__tests__/backend-projects.test.ts) | `hasBackendProjectForRootDocument`, `storeBackendProject`'s compare-before-write |
| Crypto primitives | [`insomnia-vcs/src/__tests__/crypt.test.ts`](../packages/insomnia-vcs/src/__tests__/crypt.test.ts) | RSA/AES encrypt/decrypt round trips |
| Storage | [`store/__tests__/index.test.ts`](../packages/insomnia-vcs/src/store/__tests__/index.test.ts), [`store/hooks/__tests__/compress.test.ts`](../packages/insomnia-vcs/src/store/hooks/__tests__/compress.test.ts) | CRUD, storing Buffers directly, the hook chain, extension-based compression rules |
| Shared utilities (insomnia-data) | [`common-src/deterministic-stringify.test.ts`](../packages/insomnia-data/common-src/deterministic-stringify.test.ts), [`src/models/utils/ignore-keys.test.ts`](../packages/insomnia-data/src/models/utils/ignore-keys.test.ts) | Deterministic serialization, `deleteKeys`/`resetKeys` |
| Initialization | [`main/__tests__/sync-initialization.test.ts`](../packages/insomnia/src/main/__tests__/sync-initialization.test.ts) | Branch logic for login state / git repo / storage rules; mocks `getVCSForWorkspace` |
| Conflict listener | [`ui/utils/__tests__/insomnia-sync.test.ts`](../packages/insomnia/src/ui/utils/__tests__/insomnia-sync.test.ts) | Listener registration idempotency |
| E2E | [`insomnia-smoke-test/tests/smoke/cloud-sync.test.ts`](../packages/insomnia-smoke-test/tests/smoke/cloud-sync.test.ts) | Discard/branch/commit, Push, local + remote deletion, two workspaces concurrently activating their own backend project without clobbering each other; paired with a [mock GraphQL server](../packages/insomnia-smoke-test/server/cloud-sync-api.ts) |

How to run:

```bash
npm test -w packages/insomnia          # unit tests inside packages/insomnia (initialization, conflict listener, etc.)
npm test -w packages/insomnia-vcs      # the VCS engine itself: vcs/util/crypt/store — the previous command doesn't reach these
npm test -w packages/insomnia-data     # shared utilities like deterministic-stringify, ignore-keys
npm run test:smoke:dev -- "Cloud Sync" # E2E
```
