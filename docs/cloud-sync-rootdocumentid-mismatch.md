# Cloud Sync incident: `rootDocumentId` / snapshot-workspace mismatch creates a duplicate workspace

**Status:** parts 1 and 2 of 3. This document records *what happens and why*
([Symptom](#symptom-as-reported) … [Secondary observations](#secondary-observations)) and *how the
app now handles it* ([Remediation](#remediation-how-the-app-handles-the-mismatch), implemented).
Part 3 — the root cause of the inconsistency itself, with reproduction steps and a fix plan — is
still open; see [Follow-up work](#follow-up-work).

Related: [`INS-3520`](https://konghq.atlassian.net/browse/INS-3520) is a *different* Cloud Sync
defect and is not connected to this one. General architecture background:
[`cloud-sync.md`](./cloud-sync.md).

---

## TL;DR

A remote backend project advertises one workspace id in its metadata (`rootDocumentId`) but
carries a **different** workspace id inside its committed snapshot. Insomnia trusts each of
those two values in a different code path:

- the project listing / "Unsynced" card is keyed on **`rootDocumentId`**;
- the pull writes documents using the **`_id` found in the snapshot blobs**.

So clicking the "Unsynced" card silently creates a workspace under an id the user never saw,
and the "Unsynced" card — which is computed by looking for a local workspace whose `_id`
equals `rootDocumentId` — **can never be satisfied and therefore never disappears**. The user
ends up with two entries: a real, pulled collection and an undismissable ghost.

Nothing in the app detects or reports the mismatch.

## Symptom as reported

1. A user sees a collection listed as **Unsynced** in a cloud project and clicks it.
2. A new collection appears and the app navigates into it.
3. The user deletes that new collection because they did not expect it.
4. **The original "Unsynced" entry is still there** — deleting the new one changed nothing.

Step 4 is what the report was filed about, but it is a consequence, not the bug: the ghost
entry is present before, during and after the pull. Clicking it again just re-creates the
duplicate.

## The two identifiers

| | id | source |
| --- | --- | --- |
| What the UI showed as "Unsynced" | `wrk_41e6f77bbf704f88abdc9e399c278f68` | `backendProject.rootDocumentId` from the `projects` query |
| What the pull actually created | `wrk_0fbdc57bc05f4393a49f74e1c42ed258` | `_id` inside the Workspace blob in snapshot `a198d8a5…` |

Everything else in the remote data is internally consistent around
`wrk_0fbdc57bc05f4393a49f74e1c42ed258`: the snapshot state entry's `key` is that id, the
Workspace blob's `_id` is that id, and the Base Environment blob's `parentId` points at that id.
**`rootDocumentId` is the single odd value out.**

### Full identifier set for this case

| Thing | Value |
| --- | --- |
| Organization (`teamId`) | `org_f2d7dc59-5ac1-430a-beef-7048385dfcf7` — "Kong - Team SE" |
| Local project `_id` | `proj_13a26ecb47b54e6798ce1974c23d8fd6` |
| Local project `remoteId` (`teamProjectId`) | `proj_7ca2b83bc73b411c9cc213c3a42a202f` |
| Backend project id | `prj_d9f63de28fac4ba5b22c4b657d0acabf` |
| Backend project name | `My first collection` |
| Backend project `rootDocumentId` | `wrk_41e6f77bbf704f88abdc9e399c278f68` |
| Branch | `master`, snapshots `[a198d8a5c8627a990c0fa78891cb74e527a2ac48]` |
| Snapshot author | `acct_922984e17e4d45c3bd27cf29d325eb31` — Robin Cher `<robin.cher@konghq.com>` |
| Workspace `_id` in snapshot | `wrk_0fbdc57bc05f4393a49f74e1c42ed258` |
| Base Environment `_id` in snapshot | `env_74fe90c07a8e4900fb9e407f93d4f5fb496a1a9d` |

Timeline inside the remote data — a single burst, consistent with "create collection → automatic
initial snapshot" in one session:

| Time (UTC) | Event |
| --- | --- |
| `2025-11-04T05:11:09.631Z` | Workspace `wrk_0fbdc57b…` created (`created: 1762233069631`) |
| `2025-11-04T05:11:09.642Z` | Base Environment created (`created: 1762233069642`) |
| `2025-11-04T05:11:12.129Z` | Branch `master` created |
| `2025-11-04T05:11:12.132Z` | Snapshot `a198d8a5…` "Initial Snapshot" created |
| `2025-11-04T05:11:12.134Z` | Branch `master` last modified |

Note there is **no trace of `wrk_41e6f77b…` anywhere in the snapshot data.** It exists only in the
backend project's metadata.

---

## Observed API traffic

Captured while clicking the "Unsynced" card. All five calls go to
`POST {apiBase}/graphql?<operationName>`.

### 1. `projects` — list remote backend projects for this cloud project

Request variables:

```json
{
  "teamId": "org_f2d7dc59-5ac1-430a-beef-7048385dfcf7",
  "teamProjectId": "proj_7ca2b83bc73b411c9cc213c3a42a202f"
}
```

The response contains many projects; the relevant entry:

```json
{
  "id": "prj_d9f63de28fac4ba5b22c4b657d0acabf",
  "name": "My first collection",
  "rootDocumentId": "wrk_41e6f77bbf704f88abdc9e399c278f68",
  "teamProjectId": "proj_7ca2b83bc73b411c9cc213c3a42a202f",
  "teams": [{ "id": "org_f2d7dc59-5ac1-430a-beef-7048385dfcf7", "name": "Kong - Team SE" }]
}
```

### 2. `branches` — does the default branch exist?

```json
{ "projectId": "prj_d9f63de28fac4ba5b22c4b657d0acabf" }
```

```json
{ "data": { "branches": [{ "name": "master" }] } }
```

`master` **is** present. This decides which of two divergent code paths runs — see
[The divergence](#the-divergence-two-paths-two-different-id-sources).

### 3. `branch` — fetch the branch's snapshot list

```json
{ "projectId": "prj_d9f63de28fac4ba5b22c4b657d0acabf", "branch": "master" }
```

```json
{
  "data": {
    "branch": {
      "created": "2025-11-04T05:11:12.129227Z",
      "modified": "2025-11-04T05:11:12.134144Z",
      "name": "master",
      "snapshots": ["a198d8a5c8627a990c0fa78891cb74e527a2ac48"]
    }
  }
}
```

### 4. `snapshots` — fetch the snapshot, including its state

```json
{
  "ids": ["a198d8a5c8627a990c0fa78891cb74e527a2ac48"],
  "projectId": "prj_d9f63de28fac4ba5b22c4b657d0acabf"
}
```

```json
{
  "data": {
    "snapshots": [
      {
        "author": "acct_922984e17e4d45c3bd27cf29d325eb31",
        "authorAccount": { "email": "robin.cher@konghq.com", "firstName": "Robin", "lastName": "Cher" },
        "created": "2025-11-04T05:11:12.13207Z",
        "description": "",
        "id": "a198d8a5c8627a990c0fa78891cb74e527a2ac48",
        "name": "Initial Snapshot",
        "parent": "0000000000000000000000000000000000000000",
        "state": [
          {
            "blob": "15a3e7caa8466ef48bd0ece6e796df77f4b98ebe",
            "key": "env_74fe90c07a8e4900fb9e407f93d4f5fb496a1a9d",
            "name": "Base Environment"
          },
          {
            "blob": "bf8df5bd4d695c0a61ef218254b313d88f7717e1",
            "key": "wrk_0fbdc57bc05f4393a49f74e1c42ed258",
            "name": "My first collection"
          }
        ]
      }
    ]
  }
}
```

**This is where the data first visibly disagrees with step 1.** The state entry's `key` for the
workspace is `wrk_0fbdc57bc05f4393a49f74e1c42ed258`, not the `wrk_41e6f77b…` that the backend
project claimed as its `rootDocumentId`.

`parent` is `0000…` (40 zeros) — the `EMPTY_HASH` sentinel meaning "no parent", i.e. this really
is the first snapshot on the branch.

### 5. `blobs` — fetch and decrypt the document contents

```json
{
  "ids": ["15a3e7caa8466ef48bd0ece6e796df77f4b98ebe", "bf8df5bd4d695c0a61ef218254b313d88f7717e1"],
  "projectId": "prj_d9f63de28fac4ba5b22c4b657d0acabf"
}
```

The response `content` is `JSON.stringify(AESMessage)` (see
[cloud-sync.md → 加密模型](./cloud-sync.md)). Decrypted and gunzipped:

```json
{
  "_id": "env_74fe90c07a8e4900fb9e407f93d4f5fb496a1a9d",
  "color": null,
  "created": 1762233069642,
  "data": {},
  "dataPropertyOrder": null,
  "environmentType": "kv",
  "isPrivate": false,
  "metaSortKey": 1762233069642,
  "name": "Base Environment",
  "parentId": "wrk_0fbdc57bc05f4393a49f74e1c42ed258",
  "type": "Environment"
}
```

```json
{
  "_id": "wrk_0fbdc57bc05f4393a49f74e1c42ed258",
  "created": 1762233069631,
  "description": "",
  "name": "My first collection",
  "parentId": null,
  "scope": "collection",
  "type": "Workspace"
}
```

The Workspace's `parentId: null` is **expected**, not part of the bug: `resetKeys` normalizes
`Workspace.parentId` to `null` before hashing because it points at a machine-local project id
(see `sync/ignore-keys.ts`).

> **Reproducing the decryption.** The plaintext above was obtained with a temporary debug patch in
> `_queryBlobs` (`packages/insomnia/src/main/cloud-sync/core/vcs.ts`, currently uncommitted in the
> working tree):
>
> ```ts
> for (const [id, content] of Object.entries(result)) {
>   const decompressed = zlib.gunzipSync(content);
>   console.log(`[sync] Blob ${id}:`, decompressed.toString('utf8'));
> }
> ```
>
> **This must not be committed.** It writes the full plaintext of every synced document —
> URLs, headers, request bodies, environment values — to the application log.

---

## Execution trace

Step numbers below refer to the API calls above.

| # | Location | What happens |
| --- | --- | --- |
| 1 | [`_index.tsx:221-228`](../packages/insomnia/src/routes/organization.$organizationId.project.$projectId._index.tsx#L221-L228) | The clicked card has `scope === 'unsynced'`, so it submits `pullFileFetcher` with `backendProjectId: file.remoteId` = `prj_d9f63de2…` |
| 2 | [`pull-remote-file.tsx:21`](../packages/insomnia/src/routes/organization.$organizationId.insomnia-sync.pull-remote-file.tsx#L21) | `window.main.sync.pullRemoteBackendProject({ organizationId, backendProjectId, remoteId })` |
| 3 | [`entry.preload.ts:183`](../packages/insomnia/src/entry.preload.ts#L183) | IPC `sync.pullRemoteBackendProject` → main process |
| 4 | [`ipc.ts:74-76`](../packages/insomnia/src/main/cloud-sync/ipc.ts#L74-L76) | → `pullRemoteBackendProjectWithSingleton` |
| 5 | [`main/cloud-sync/vcs.ts:116-171`](../packages/insomnia/src/main/cloud-sync/vcs.ts#L116-L171) | **API call 1.** Finds the backend project by `id`, resolves the local project, creates an isolated `pullVCS`, then `removeBackendProjectsForRoot(rootDocumentId)` — clearing local metadata for `wrk_41e6f77b…` |
| 6 | [`pull-backend-project.ts:18-24`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts#L18-L24) | `setBackendProject` (persists `meta.json` with `rootDocumentId: wrk_41e6f77b…`), `checkout([], 'master')`, then **API call 2** |
| 7 | [`pull-backend-project.ts:46-51`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts#L46-L51) | `vcs.pull({ candidates: [] })` → **API calls 3, 4, 5**; snapshot + blobs are decrypted and stored locally |
| 8 | [`pull-backend-project.ts:56-72`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts#L56-L72) | **The duplicate workspace is created here** |
| 9 | [`pull-remote-file.tsx:34`](../packages/insomnia/src/routes/organization.$organizationId.insomnia-sync.pull-remote-file.tsx#L34) | `redirect(...)` into the newly created workspace |

Resulting navigation:

```
/organization/org_f2d7dc59-5ac1-430a-beef-7048385dfcf7
  /project/proj_13a26ecb47b54e6798ce1974c23d8fd6
  /workspace/wrk_0fbdc57bc05f4393a49f74e1c42ed258/debug
```

### Where the workspace is created

`packages/insomnia/src/main/cloud-sync/pull-backend-project.ts:53-75`:

```ts
const flushId = await database.bufferChanges();
let workspaceId;
// @ts-expect-error -- TSCONVERSION
for (const doc of (await vcs.allDocuments()) || []) {
  if (models.workspace.isWorkspace(doc)) {
    doc.parentId = remoteProject._id;
    workspaceId = doc._id;              // :61  ← id comes from the BLOB
  }
  if (models.projectLintRuleset.isProjectLintRuleset(doc)) {
    doc.parentId = remoteProject._id;
  }
  const allModelType = models.types();
  if (allModelType.includes(doc.type)) {
    await database.update(doc);         // :70  ← creates the workspace
  }
}
await database.flushChanges(flushId);
```

Two things to note:

- **`database.update` is an upsert, not an update.** `database-nedb.ts:466`:
  ```ts
  await nedbBucket[doc.type].updateAsync({ _id: docWithDefaults._id }, docWithDefaults, { upsert: true });
  ```
  There is no local document with `_id = wrk_0fbdc57b…`, so this **inserts** one.

- **The id is taken from the snapshot, never from `rootDocumentId`.**
  [`vcs.allDocuments()`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L499-L507) reads the
  latest snapshot's `state[].blob` and returns the decrypted blob contents. `doc._id` is therefore
  whatever the blob says — `wrk_0fbdc57b…`. `backendProject.rootDocumentId` is not consulted
  anywhere in this loop.

Also note `pullBackendProject` **discards the delta returned by `vcs.pull()`** and re-reads the
whole snapshot through `allDocuments()` instead.

### The divergence: two paths, two different id sources

`pullBackendProject` has two mutually exclusive branches that disagree about where the workspace
id comes from:

| Branch | Condition | Workspace id from | Would have produced |
| --- | --- | --- | --- |
| [`:30-44`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts#L30-L44) | remote has **no** `master` | `_id: backendProject.rootDocumentId` | `wrk_41e6f77b…` |
| [`:56-72`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts#L56-L72) | remote **has** `master` | `doc._id` from the blob | `wrk_0fbdc57b…` |

API call 2 returned `master`, so the second path ran. Had the remote branch been missing, the
*same input data* would have produced a workspace with the *other* id. This structural
disagreement is what turns a data inconsistency into a visible duplicate.

---

## Why the "Unsynced" ghost never disappears

This is the part that produced the user report, and it is independent of the pull.

The "Unsynced" list is built by
[`getAllRemoteFiles`](../packages/insomnia/src/ui/utils/remote-projects.ts#L9-L65), called from the
project index loader ([`_index.tsx:73`](../packages/insomnia/src/routes/organization.$organizationId.project.$projectId._index.tsx#L73)):

```ts
// remote-projects.ts:33-45
const workspacesWithBackendProjects = await services.workspace.list({
  _id: { $in: [...].map(p => p.rootDocumentId) },
  parentId: project._id,
});

const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(
  p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId),
);

return backendProjectsToPull.map(backendProject => ({
  id: backendProject.rootDocumentId,   // :49  ← the card's id
  name: backendProject.name,
  scope: 'unsynced',
  remoteId: backendProject.id,         // :53  ← what gets pulled
  ...
}));
```

A backend project is considered "unsynced" **iff no local workspace has
`_id === backendProject.rootDocumentId`**.

For `prj_d9f63de2…` that predicate asks: *"is there a local workspace with
`_id = wrk_41e6f77b…`?"* The pull creates `wrk_0fbdc57b…`, so the answer stays **no** — forever.
Therefore:

- the ghost card is shown **before** the pull (correctly) and **after** the pull (incorrectly);
- deleting the pulled `wrk_0fbdc57b…` has no effect on it, exactly as the user observed;
- clicking it again re-runs the whole pull and re-creates `wrk_0fbdc57b…`;
- the pulled collection and the ghost card coexist indefinitely.

### A second consequence: the pulled collection is detached from its history

Step 6 persists `/projects/prj_d9f63de28fac4ba5b22c4b657d0acabf/meta.json` with
`rootDocumentId: wrk_41e6f77b…`, but the workspace that actually exists locally is
`wrk_0fbdc57b…`.

When that workspace is opened,
[`workspace.$workspaceId.tsx:284`](../packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx#L284)
calls `switchAndCreateBackendProjectIfNotExist(wrk_0fbdc57b…, name)`.
[`_getBackendProjectByRootDocument`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1490-L1523)
matches on `rootDocumentId` exactly, so it does **not** find `prj_d9f63de2…` and creates a brand
new local backend project instead.

Consequence: the pulled collection is no longer associated with `prj_d9f63de2…` or its history. If
the user commits and pushes, a *second* collection is created in the cloud rather than a new
snapshot on the existing one.

*(Not yet verified end-to-end against a live account — this follows from reading the code and
should be confirmed while validating the fix.)*

---

## Secondary observations

Found while tracing; neither causes this bug.

1. **A dead filter in `getAllRemoteFiles`.**
   [`remote-projects.ts:25`](../packages/insomnia/src/ui/utils/remote-projects.ts#L25):
   ```ts
   window.main.sync.localBackendProjects().then(projects => projects.filter(p => p.id === remoteId))
   ```
   `p.id` is a backend project id (`prj_…`) while `remoteId` is a team project id (`proj_…`).
   These namespaces never overlap, so `allPulledBackendProjectsForRemoteId` is **always empty**.
   It is harmless today only because the fetched remote list already covers the same set.

2. **The mismatch is never validated.** No code path compares
   `backendProject.rootDocumentId` against the workspace found in the snapshot. The pull succeeds
   silently, and the only user-visible signal is the duplicate.

3. **`allDocuments()`'s return type is wrong.** It is annotated
   `Promise<Record<string, any>>` but `_getBlobs` returns an array — hence the `@ts-expect-error`
   on the `for…of` in `pullBackendProject`.

## What is *not* the cause

- **Not encryption or transport.** Blobs decrypt cleanly and the snapshot hash chain is intact.
- **Not `resetKeys`/`parentId: null`.** That normalization is intentional and both the main-process
  pull and `reparentSyncDelta` repair it.
- **Not the client's project-creation code, on its face.** When
  [`_queryCreateProject`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1277-L1347) creates a
  remote project it sets `rootDocumentId` from the local backend project's `rootDocumentId`, while
  the snapshot content comes from `getSyncItems(<that same workspace>)`. In the normal flow the two
  agree. **How they came to disagree for `prj_d9f63de2…` is the subject of part 3** and is not
  established by this document.

---

# Remediation: how the app handles the mismatch

## Governing principle: the snapshot is authoritative, `rootDocumentId` is a repairable pointer

The two values cannot both be treated as identity, so one has to win. It has to be the snapshot:

| | Workspace `_id` in the snapshot | `rootDocumentId` |
| --- | --- | --- |
| Mutability | **Immutable.** It is the sync `key`; changing it changes the blob hash and therefore the snapshot id | Mutable server-side metadata |
| Blast radius | Already agreed upon by every client that pulled this backend project | Only used for lookup and matching |
| Role | **It is the data** | Metadata *about* the data |

So the fix accepts the snapshot and repairs the pointer. Concretely, four changes.

### 1. Reconcile local metadata during the pull

[`root-document-id.ts`](../packages/insomnia/src/main/cloud-sync/root-document-id.ts) →
`reconcileBackendProjectRootDocumentId`, called from
[`pull-backend-project.ts`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts). When
the workspace found in the snapshot differs from `backendProject.rootDocumentId`, the locally
stored `meta.json` is rewritten to the snapshot's value.

This also repairs the ["detached history"](#a-second-consequence-the-pulled-collection-is-detached-from-its-history)
consequence: `_getBackendProjectByRootDocument` matches again, so opening the pulled collection
reuses `prj_d9f63de2…` instead of creating a new backend project, and pushing adds a snapshot to
the existing collection rather than creating a duplicate in the cloud.

Note this is a **purely local** repair. There is no GraphQL mutation that can change
`rootDocumentId` (the API surface is `projectCreate` / `projectArchive` / `branchRemove` /
`snapshotsCreate` / `blobsCreate`), so fixing the server row would require a backend change. The
client does not need to wait for one: every installation heals itself independently.

### 2. Resolve the "Unsynced" predicate against *both* identities

This is the change that makes the ghost card disappear.
[`remote-projects.ts`](../packages/insomnia/src/ui/utils/remote-projects.ts) previously asked only
*"is there a local workspace whose `_id` equals the remote `rootDocumentId`?"* — a question that can
never be answered once that value is wrong. It now also asks the same question of the workspace that
the pull actually produced, looked up by backend project id (globally unique, and the stable
identity of the remote repository):

```ts
const localBackendProjectsById = new Map(localBackendProjects.map(p => [p.id, p]));
const projectWorkspaces = await services.workspace.listByParentId(project._id);
const projectWorkspaceIds = new Set(projectWorkspaces.map(w => w._id));

const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(p => {
  const localRootDocumentId = localBackendProjectsById.get(p.id)?.rootDocumentId;
  return ![p.rootDocumentId, localRootDocumentId].some(
    rootDocumentId => rootDocumentId && projectWorkspaceIds.has(rootDocumentId),
  );
});

// Several backend projects can advertise the same rootDocumentId, and the card id is derived from
// it, so the list has to be deduplicated or the file grid renders duplicate React keys.
return getUnsyncedRemoteWorkspaces(files, projectWorkspaces);
```

> **Both** checks are required, and an earlier revision of this fix got it wrong by *replacing* the
> remote-`rootDocumentId` check with the local-metadata one instead of adding to it. That silently
> dropped the "this workspace already exists locally" guard for any backend project with no local
> metadata: such a project was offered for pulling, and because the card id is derived from
> `rootDocumentId`, it collided with the real local card and React reported
> `Encountered two children with the same key`. Dropping either check reintroduces a duplicate.

Checking both also preserves the correct behaviour for a collection that was pulled and then deleted
locally: neither id resolves to a workspace, so it is offered for pulling again.

The final `getUnsyncedRemoteWorkspaces` call reuses the dedupe that
[`project-navigation-sidebar.tsx:448`](../packages/insomnia/src/ui/components/sidebar/project-navigation-sidebar/project-navigation-sidebar.tsx#L448)
already applied — the sidebar had this safety net and the dashboard route did not, which is why the
duplicate-key warning only appeared on the dashboard. Its existence (and its
`[Duplicate Remote File]` warning) is evidence that **several backend projects sharing one
`rootDocumentId` is a pre-existing, already-observed condition** in production data, not something
this incident introduced.

This change also removes the [dead filter](#secondary-observations) that compared `prj_…` ids
against a `proj_…` team project id.

### 3. Repair installations that were already affected

Changes 1 and 2 are not enough on their own for a user who already hit this: their stored
`meta.json` still points at `wrk_41e6f77b…`, which resolves to no workspace, so the collection would
*still* be reported as unsynced.

`repairLocalBackendProjectRootDocuments` handles that. For each local backend project whose declared
root resolves to no workspace, it reads the workspace entry out of the latest local snapshot and, if
that workspace does exist locally, rewrites the pointer. It is exposed as
`window.main.sync.reconcileLocalBackendProjects()` and runs at the top of `getAllRemoteFiles`,
replacing the previous `localBackendProjects()` call, so it costs no extra IPC round trip.

It is idempotent, needs no network, and in the healthy case costs a single batched
`services.workspace.list` query — no per-project snapshot reads happen unless something is actually
broken.

Reading the snapshot uses a new accessor,
[`VCS.latestSnapshotStateForBackendProject`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts),
which addresses `head.json` / `branches/*.json` / `snapshots/*.json` through the store directly
rather than going through the `_get*` helpers. Those helpers all derive their paths from the active
backend project, so using them would have meant assigning `_backendProject` — and they are not
side-effect free either: `_getHead` writes a default head when none exists and
`_getOrCreateBranch` writes an empty branch. Addressing the store explicitly keeps the accessor
read-only in both senses: no mutation of the active project, so it is safe to call while another
operation is in flight, and nothing is created as a side effect of inspecting a project.

### 4. Fail loudly only when the snapshot is genuinely unusable

A `rootDocumentId` mismatch is recoverable and must not block the user — the collection itself is
perfectly intact. Two other cases are *not* recoverable, and `pullBackendProject` now validates them
**before** writing anything, so a broken snapshot can no longer leave orphaned documents behind:

- **zero workspaces** in the snapshot — previously `workspaceId` stayed `undefined` and an
  `invariant` fired only *after* the loop had already written every other document to the database;
- **more than one workspace** — previously the last one silently won, despite the code comment
  asserting this cannot happen.

## What is deliberately *not* done

**No user-facing warning.** After reconciliation the outcome is exactly what the user asked for:
one click on an "Unsynced" card produces one collection and the card disappears. The original
complaint was never "a workspace was created" — it was "a workspace was created *and the thing I
clicked is still there*", which read as a duplicate or a failure. A dialog about inconsistent remote
metadata would be noise the user cannot act on.

**No rewriting of the workspace `_id`.** Remapping the pulled workspace onto `rootDocumentId` looks
attractive because local state would then match the clicked card, but it is the one genuinely
dangerous option. `_id` is the sync `key`: the next `status()` would compare local
`wrk_41e6f77b…` against snapshot `wrk_0fbdc57b…`, read it as *delete + add*, and the next commit
would rewrite the collection's identity for **every** client that has already pulled it. A local
inconsistency would become a remote one.

**Observability instead.** `reconcileBackendProjectRootDocumentId` emits a `console.warn` for
support, plus an `AnalyticsEvent.vcsAction` with `action: 'root_document_id_mismatch'` and the
backend project id. That measures how many backend projects are affected and gives a signal that
should drop to zero once part 3 lands.

## Changed files

| File | Change |
| --- | --- |
| [`main/cloud-sync/root-document-id.ts`](../packages/insomnia/src/main/cloud-sync/root-document-id.ts) | **New.** Pull-time reconciliation + the repair pass |
| [`main/cloud-sync/pull-backend-project.ts`](../packages/insomnia/src/main/cloud-sync/pull-backend-project.ts) | Validate the snapshot before writing; reconcile the pointer |
| [`main/cloud-sync/core/vcs.ts`](../packages/insomnia/src/main/cloud-sync/core/vcs.ts) | Add `latestSnapshotStateForBackendProject` |
| [`main/cloud-sync/ipc.ts`](../packages/insomnia/src/main/cloud-sync/ipc.ts) | `sync.reconcileLocalBackendProjects` handler + bridge type |
| [`main/ipc/electron.ts`](../packages/insomnia/src/main/ipc/electron.ts) | Register the new channel |
| [`entry.preload.ts`](../packages/insomnia/src/entry.preload.ts) | Expose `reconcileLocalBackendProjects` |
| [`ui/utils/remote-projects.ts`](../packages/insomnia/src/ui/utils/remote-projects.ts) | Match on backend project id; resolve roots from local metadata |
| [`main/cloud-sync/__tests__/root-document-id.test.ts`](../packages/insomnia/src/main/cloud-sync/__tests__/root-document-id.test.ts) | **New.** 5 tests |

Tests cover: matching metadata is left untouched; a mismatch is persisted (and the backend project
id never changes); the repair pass fixes a stale pointer, skips a healthy one, and leaves a
genuinely unpulled project alone.

> The test uses `FileSystemDriver` on a temp directory rather than `MemoryDriver`, because
> `_allBackendProjects` derives project ids from a non-recursive key listing that only yields
> directory names on a real filesystem — under `MemoryDriver` it yields `meta.json` and
> `localBackendProjects()` comes back empty. Worth knowing before writing further VCS tests.

---

## Follow-up work

- **Part 3 — root cause.** Determine how the inconsistency is produced, provide reliable
  reproduction steps, and plan the fix. One hypothesis worth testing first: `status` / `stage` /
  `takeSnapshot` never verify that the supplied candidates belong to the active backend project's
  root, and `_backendProject` is mutable state on a process-wide singleton — so concurrent
  workspace initialization could commit workspace A's documents into workspace B's backend
  project. See "已知缺陷与设计债" item 4 in [`cloud-sync.md`](./cloud-sync.md).
- Confirm the "detached history" consequence above against a live account, and verify the
  reconciliation resolves it.
- Consider a server-side repair for existing bad rows. It needs a new mutation; the client fix does
  not depend on it, but until it happens every client pays the one-time local repair.
- Remove the temporary blob-logging patch from `core/vcs.ts` before committing anything.
