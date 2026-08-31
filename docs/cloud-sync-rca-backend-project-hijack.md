# RCA: Singleton VCS State Hijacked by a Concurrent Request, Causing One Workspace's Commit to Land in Another Workspace's BackendProject

**Status**: Root cause confirmed via code review and a controlled reproduction. No fix has been implemented yet.

All code links below point to commit [`cc64ba83c`](https://github.com/Kong/insomnia/commit/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3) on `Kong/insomnia`.

---

## Table of Contents

1. [Symptom](#symptom)
2. [Root Cause in One Sentence](#root-cause-in-one-sentence)
3. [Full Causal Chain](#full-causal-chain)
4. [Key Code Evidence](#key-code-evidence)
5. [Controlled Reproduction](#controlled-reproduction)
6. [Reproduction Log Walkthrough](#reproduction-log-walkthrough)
7. [Real-World Trigger Conditions](#real-world-trigger-conditions)
8. [Impact and Severity](#impact-and-severity)
9. [Affected Code Locations](#affected-code-locations)
10. [Temporary Debug Instrumentation (to be removed)](#temporary-debug-instrumentation-to-be-removed)
11. [Possible Fix Directions (undecided, for discussion)](#possible-fix-directions-undecided-for-discussion)
12. [Remediating Already-Corrupted Data (open discussion)](#remediating-already-corrupted-data-open-discussion)

---

## Symptom

A user clicked on a Collection shown as **unsynced** in the UI (its locally-known workspace id is referred to below as `wrk_A`), which triggered `pullRemoteBackendProject`. Packet capture showed:

- The GraphQL `projects` query returned a remote BackendProject `{ id: prj_X, rootDocumentId: wrk_A }`.
- That project's `master` branch had exactly one snapshot (`Initial Snapshot`, `parent = EMPTY_HASH`). Once decrypted, the Workspace-type blob referenced by that snapshot had `_id: wrk_B` — which does **not** match `rootDocumentId`.
- The pull flow faithfully built a local workspace from the blob content (`_id = wrk_B`). The user then deleted this newly-created workspace, went back to the collection list, and found the original `wrk_A` "unsynced" entry was still there — the delete appeared to have no effect.

This document focuses on **how a BackendProject's `rootDocumentId` and its own snapshot content became inconsistent on the server in the first place**.

## Root Cause in One Sentence

The VCS running in the main process is a **single shared instance**, and `this._backendProject` (i.e. "which workspace's project is currently active") is a **mutable field with no locking and no per-request isolation**. Methods such as `status`, `stage`, `takeSnapshot`, and `push` all read `this._backendProject` at the moment they execute, rather than having the target project pinned down when the caller starts the operation. If, between the "activate project" and "commit" steps of one workspace's flow, **any concurrent request for a different workspace** calls `switchAndCreateBackendProjectIfNotExist`, the in-flight operation silently gets attached to the wrong project.

## Full Causal Chain

Below, `Y` denotes the workspace being newly created/initialized, and `X` denotes another, already-synced workspace whose page happened to be the active route in the renderer at that moment:

```
Renderer: "New Collection" submitted → workspace.new.tsx clientAction
  → window.main.initializeWorkspaceBackendProject({ workspaceId: Y })
    → Main process: initializeLocalBackendProjectAndMarkForSync(vcs = singleton VCS, workspace = Y)

      ① switchAndCreateBackendProjectIfNotExist(Y._id, Y.name)
         → _backendProject = P_Y   (P_Y is the local BackendProject just created for Y)

      ┄┄┄┄┄┄┄┄┄┄┄┄ concurrency window ┄┄┄┄┄┄┄┄┄┄┄┄
      At this point the renderer's active/foregrounded route is still X's workspace page
      (Insomnia renders exactly one route at a time — there is no persistent background-tab
      mounting; X's page simply had not been navigated away from yet, because creating a new
      collection from X's page does not itself navigate anywhere until this whole flow, including
      the artificially widened delay used for reproduction, completes).
      X's page has a mounted SyncDropdown component whose periodic 60-second poll or
      window-focus listener fires triggerSync():
        → sync-data route's clientAction resolves
        → React Router's default behavior: revalidate every currently mounted loader
          → X's root route loader re-runs switchAndCreateBackendProjectIfNotExist(X._id, X.name)
             → _backendProject = P_X   ← the singleton gets hijacked before P_Y is ever used
          → X's sync-data loader re-runs status(X's own candidates)
             → harmless on its own; what actually causes the damage is that ②③④ below run
               against the now-hijacked _backendProject

      NOTE: triggerSync() is only the ONE trigger we have identified and can reliably
      reproduce. React Router revalidates every mounted loader after ANY action or fetcher
      submission resolves — not only sync-related ones. As long as X's page is the mounted
      route, submitting *any* action anywhere in the app (creating a request, renaming an
      item, saving a script, toggling a setting, etc.) would revalidate X's root route loader
      the same way and could hijack _backendProject just as easily. This causal chain is
      therefore only one concrete instance of a broader class of triggers; there are very
      likely other, equally valid paths into the same race that we have not enumerated.
      ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

      ② status(Y's candidates)      → reads this._backendProjectId() = P_X.id (wrong!)
         getStagable(P_X's latest snapshot state, Y's candidates) computes a diff:
           - P_X's own existing documents (absent from Y's candidates) → marked deleted: true
           - Y's documents (absent from P_X's snapshot)                → marked added: true

      ③ stage(the unstaged entries above)  → written into this._stageByBackendProjectId[P_X.id]

      ④ takeSnapshot('Initial Snapshot')   → reads this._backendProjectId() = P_X.id (still wrong)
         newState = (entries from P_X's previous snapshot NOT overridden by the stage)
                    ∪ (non-deleted entries from the stage)
         → P_X's own two documents are dropped because they were marked deleted
         → the new snapshot contains only Y's documents
         → this "new snapshot" is appended to P_X's branch and written to disk under
           version-control/projects/<P_X.id>/snapshots/

      Result: P_X's meta.json.rootDocumentId is still X's real id, but its latest snapshot
              content is entirely Y's documents, and X's own original content has been
              "deleted" and lost.

    ← initializeLocalBackendProjectAndMarkForSync returns; workspace.new.tsx redirects to Y's page
      → Y's root route loader re-runs switchAndCreateBackendProjectIfNotExist(Y) → _backendProject
        switches back to P_Y (empty)
      → pushSnapshotOnInitialize calls push() against P_Y → P_Y's local history is empty →
        throws "Already up to date", silently swallowed
      (The corrupted snapshot sitting inside P_X is, at this point, still purely local. The next
       time X itself pushes — whether via the automatic background poll or a manual commit by its
       user — that corrupted snapshot is what gets pushed to the remote. From that point on, a
       GraphQL query against P_X will show "rootDocumentId belongs to X, content belongs to Y" —
       exactly matching the packet capture from the original report.)
```

## Key Code Evidence

| Step | Location | Key detail |
| --- | --- | --- |
| ① activates the project; ②③④ commit — all in one function, but each step is its own independent `await` | [`sync/vcs/initialize-backend-project.ts#L16-L53`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/sync/vcs/initialize-backend-project.ts#L16-L53) | `switchAndCreateBackendProjectIfNotExist` → `status` → `stage` → `takeSnapshot`: four independent async/IPC calls with no lock in between |
| `status`/`stage`/`takeSnapshot` read the singleton's live state | [`core/vcs.ts` `status()` L265](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L265), [`stage()` L332](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L332), [`takeSnapshot()` L614](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L614) | All three use `this._stageByBackendProjectId[this._backendProjectId()]`; `_backendProjectId()` ([L1439-L1445](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L1439-L1445)) is a live read of `this._backendProject.id`, not a value passed in by the caller |
| The singleton's "current project" can be replaced by any concurrent call | [`setBackendProject()` L119-L124](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L119-L124) | `this._backendProject = backendProject`, with no reference counting or per-workspace isolation |
| "absent from the candidate set" is treated as "should be deleted" | [`core/util.ts` `getStagable()` L315-L368](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/util.ts#L315-L368) | `entry && !candidate → deleted: true` (L338-L347) — this is the direct reason X's own documents get marked for deletion |
| `takeSnapshot` faithfully honors the deletion | [`core/vcs.ts#L614-L656`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L614-L656) | "Don't add anything that's in the stage (this covers deleted things too)" |
| Who triggers "switch to another workspace" and when | [`workspace.$workspaceId.tsx#L284`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx#L284) | The root route loader unconditionally calls `switchAndCreateBackendProjectIfNotExist(workspaceId, ...)` every time this route is mounted or revalidated |
| One concrete trigger for the background route revalidation (not the only one) | [`sync-dropdown.tsx#L72-L89, L159-L164`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx#L72-L89) | `triggerSync()` is driven by window-focus regain (`mainWindowFocusChange`) or a 60-second poll, and submits the `sync-data` action. React Router's default behavior then revalidates every currently mounted loader — including the root route's `switchAndCreateBackendProjectIfNotExist` call. This is simply the trigger we found and could reproduce reliably; **any** action/fetcher submission anywhere in the app, while another workspace's route is mounted, revalidates that route's loaders the same way and is an equally plausible trigger |
| `push` also reads the singleton's live state, and can implicitly create a remote project | [`core/vcs.ts` `push()` L732](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L732), [`_getOrCreateRemoteBackendProject()` L705-L715](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts#L705-L715) | The `rootDocumentId`/`name` used by `_getOrCreateRemoteBackendProject` also come from `this._assertBackendProject()` (i.e. the current singleton state), not from a workspace specified by the caller |

## Controlled Reproduction

In practice this window is typically only tens to a couple hundred milliseconds wide, so it cannot be reproduced reliably by manual clicking alone. The reproduction method artificially widens the window between step ① and steps ②③④ inside `initializeLocalBackendProjectAndMarkForSync` from tens of milliseconds to 20 seconds, combined with logging of the currently-active project id/rootDocumentId in the key `core/vcs.ts` methods (see [Temporary Debug Instrumentation](#temporary-debug-instrumentation-to-be-removed) below for the exact, currently-uncommitted patch).

**Steps**:

1. Open a project with Cloud Sync enabled, with at least one already-synced Collection present (referred to below as X).
2. Navigate into Collection X so its page is the active route.
3. From X's page, trigger creating a new Collection (referred to below as Y). The creation flow will stall for 20 seconds inside the artificial delay (this is expected — leave the dialog as is).
4. Do nothing else. As long as X's page stays the active route, its own background refresh (a window-focus regain, or the 60-second poll elapsing) will automatically hijack the singleton's `_backendProject`.
5. After the 20-second delay elapses, check the main-process terminal log: the `rootDocumentId` printed when `takeSnapshot()` commits belongs to X, but the `entry keys` list contains Y's workspace id — local corruption reproduced.
6. (Optional) Inspect `<userData>/version-control/projects/<X's project id>/` to confirm `meta.json.rootDocumentId` does not match the new snapshot's content; trigger X's next push and use the DevTools Network panel to confirm the same inconsistency appears on the remote side as well.

## Reproduction Log Walkthrough

Excerpt from one actual reproduction run (Y = `Collection W` / `wrk_af3337a8...`, X = `Collection X` / `wrk_7fda60c4...`):

```
15:27:24.007  [sync] Created backend project prj_558fce58...
15:27:24.008  setBackendProject → id=prj_558fce58... rootDocumentId=wrk_af3337a8... name=Collection W   ← ①, _backendProject = P_Y
15:27:24.014  entering the 20000ms delay window
15:27:36.805  [remoteBackendProjects] Fetching remote workspaces...                                     ← X's sync-data clientAction (triggerSync)
15:27:37.131  [remoteBackendProjects] Fetched 1 remote workspaces
15:27:37.199  setBackendProject → id=prj_bd142821... rootDocumentId=wrk_8d7bbf38... name=Collection X    ← X's root route loader revalidated, _backendProject hijacked to P_X
15:27:37.213  status() running against active project ...Collection X...                                 ← X's sync-data clientLoader, same revalidation wave
15:27:44.022  delay elapsed, resuming status/stage/takeSnapshot.                                         ← Y's flow resumes; _backendProject is still P_X
```

A second reproduction run more fully demonstrates the "deletion" effect (Y = `wrk_af3337a8...`, X = `wrk_7fda60c4...`, X's pre-existing content was `env_b67676c7...` + itself):

```
stage() keys = env_b67676c7(X's env), wrk_7fda60c4(X itself), wrk_af3337a8(Y), env_34d68cbc(Y's env)
takeSnapshot() committed entry keys = wrk_af3337a8(Y), env_34d68cbc(Y's env)   ← X's own two entries are entirely gone
```

This log proves that X's original two documents were not merely "mixed into" Y's snapshot — `getStagable` marked them `deleted`, and `takeSnapshot` dropped them entirely. **X's already-synced real content was lost, not just mislabeled.**

## Real-World Trigger Conditions

Tracing the log lines back to their call sites (see the right-hand annotations above) shows that **no step in this chain requires manual intervention**:

- `X` only needs to be the workspace page the user happens to currently be viewing when they trigger "New Collection" from there. Insomnia renders exactly one route at a time — there is no hidden/background tab that stays mounted; X's page is simply the foreground route that has not navigated away yet, because opening the creation flow from X's page does not itself cause a navigation until the whole (delayed) flow completes.
- The trigger we identified and reliably reproduced is X's completely ordinary background-refresh logic: a window-focus regain (`mainWindowFocusChange`) or the 60-second poll ([`sync-dropdown.tsx#L159-L164`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx#L159-L164)).
- React Router's default revalidation behavior (revalidate every mounted loader after any action/fetcher submission resolves) "spreads" that refresh to X's root route loader, which is what actually calls `switchAndCreateBackendProjectIfNotExist`.

**This is only one instance of a much broader trigger class.** React Router revalidates every currently mounted loader after *any* action or fetcher submission completes — not specifically sync-related ones. So while X's page is mounted, essentially any mutation performed anywhere in the app (creating or editing a request, renaming a folder, saving an environment, submitting a settings form, etc.) would revalidate X's root route loader the same way and could hijack `_backendProject` just as effectively. We have only found and confirmed one easy-to-reproduce path (the background sync poll/focus refresh); we have not attempted to enumerate the others, and there is no reason to believe it is the only one.

In other words: **any user who creates a new collection while already viewing another synced collection has a chance of hitting this bug, as long as *some* action fires anywhere in the app during that window** — window-focus regain and the 60-second poll are simply the easiest one to trigger and reproduce on demand, not the only qualifying event. No deliberate fast tab-switching or DevTools use is required; this is an ordinary, everyday usage pattern. In production the window is only tens to a couple hundred milliseconds wide, so the odds per occurrence are low, but they rise with user count, workspace count, general app activity, and slower disks/IPC (which widen the window).

## Impact and Severity

1. **Data loss, not just a mislabeled record**: the hijacked project (X) will, on its next push, overwrite/replace its own already-synced content with another workspace's content — via what looks like an entirely ordinary commit. There is no warning to the user; they will only discover it later, e.g. when looking at remote history and finding their collection now has a different name and content.
2. **A ghost "unsynced" entry**: the victim side (`wrk_A` in the [Symptom](#symptom) section) cannot be cleaned up through normal UI actions.
3. **Low trigger threshold**: as described above, this only requires the extremely common habit of "create a new collection while looking at another one" — no unusual action needed.
4. **Silent failure**: exceptions such as "Already up to date" thrown from `pushSnapshotOnInitialize` are silently swallowed by [`workspace.$workspaceId.tsx#L289-L291`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx#L289-L291) (`catch (err) { console.warn(...) }`), so neither the user nor routine log monitoring will notice anything.

## Affected Code Locations

- [`packages/insomnia/src/sync/vcs/initialize-backend-project.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/sync/vcs/initialize-backend-project.ts) — `initializeLocalBackendProjectAndMarkForSync`, `pushSnapshotOnInitialize`
- [`packages/insomnia/src/main/cloud-sync/core/vcs.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts) — `setBackendProject`, `switchAndCreateBackendProjectIfNotExist`, `status`, `stage`, `takeSnapshot`, `push`, `_getOrCreateRemoteBackendProject`, `_backendProjectId`
- [`packages/insomnia/src/main/cloud-sync/core/util.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/util.ts) — `getStagable` (the "absent from candidates = delete" semantics are correct in isolation; they only become destructive when the candidates and the currently-active project don't actually correspond to the same workspace)
- [`packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx) — root route loader unconditionally calling `switchAndCreateBackendProjectIfNotExist`
- [`packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/ui/components/dropdowns/sync-dropdown.tsx) — the poll-/focus-driven `triggerSync`, the most common source of "a concurrent request for another workspace"
- [`packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data.tsx`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data.tsx) — the `clientLoader`/`clientAction` that gets revalidated
- [`packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.new.tsx`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.new.tsx) — calls `window.main.initializeWorkspaceBackendProject`, the entry point into the vulnerable flow (L169-L172, L384-L387)

## Temporary Debug Instrumentation (to be removed)

To make this bug reproducible, a delay and some logging were added locally on top of the commit referenced above. These are **not part of `cc64ba83c` and have not been committed** — they need to be removed once a fix is agreed on:

| File (working tree, not yet committed) | Content |
| --- | --- |
| `packages/insomnia/src/sync/vcs/initialize-backend-project.ts` | A `RACE_REPRO_DELAY_MS = 20_000` `setTimeout` delay, plus one `[RACE-REPRO]` log line before and after it |
| `packages/insomnia/src/main/cloud-sync/core/vcs.ts` | 6 `[RACE-REPRO]` log lines: in `setBackendProject`, `status`, `stage`, at the start and end of `takeSnapshot`, and in `push` |

All of it can be located with `grep -rn "RACE-REPRO"` or `grep -rn "RACE_REPRO_DELAY_MS"`.

## Possible Fix Directions (undecided, for discussion)

The following are directions only, not an agreed-upon plan:

- Have `status`/`stage`/`takeSnapshot`/`push` accept the target `backendProjectId` (or `rootDocumentId`) explicitly, and validate it against the currently-active project at call time — erroring out on a mismatch instead of silently committing against the wrong project. This turns an implicit dependency on singleton state into an explicit, caller-declared target.
- Add a mutex/queue around the singleton VCS's critical operation sequence, so that only one "switch → status → stage → takeSnapshot → push" chain can run at a time, and concurrent requests queue instead of interleaving.
- **Give each workspace its own VCS instance** (the same pattern `pullRemoteBackendProjectWithSingleton` already uses to sidestep the singleton for pulls), eliminating the "currently active project" global mutable state at the root. This is the currently preferred direction; a more detailed effort/impact assessment follows below.

The trade-offs between these (performance, scope of change, whether existing corrupted data needs a separate remediation pass) are left for a follow-up discussion.

### Effort and impact assessment: per-workspace VCS instances

**Why this is structurally sound.** The `VCS` class itself is already instance-scoped — nothing in [`core/vcs.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/vcs.ts) assumes there is only one instance; the singleton-ness lives entirely outside it, in [`main/cloud-sync/vcs.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts)'s module-level `let mainVCS: VCS | null` and `getMainVCS()` ([L34, L56-L67](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts#L56-L67)). Constructing a `VCS` instance is cheap: [`createVCS()`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/create-vcs.ts#L10-L12) just calls `new VCS(FileSystemDriver.create(dataPath), conflictHandler)`; `FileSystemDriver` ([`file-system-driver.ts#L7-L18`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/store/drivers/file-system-driver.ts#L7-L18)) and `Store` ([`store/index.ts#L15-L22`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/store/index.ts#L15-L22)) hold nothing but a directory path string and a hooks array — no open file handles, no eager I/O, no in-memory cache built at construction time. Every read/write hits the filesystem fresh on demand. This means holding one long-lived `VCS` instance per workspace for the lifetime of the app process is inexpensive; there is no per-instance resource leak to manage, and no need for eviction/LRU logic as a first pass. The codebase already validates this pattern in production: `pullRemoteBackendProjectWithSingleton` ([`main/cloud-sync/vcs.ts#L116-L157`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts#L116-L157)) already spins up a throwaway isolated `VCS` instance per pull specifically to avoid mutating the singleton's active project — this change generalizes that existing, working pattern to every operation instead of just one.

**What has to change.**

1. **IPC contract.** `sync.invoke` currently dispatches reflectively with no workspace/project identifier at all — `invokeMainVCS(sender, methodName, ...args)` ([`main/cloud-sync/vcs.ts#L73-L82`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts#L73-L82)) always resolves to the single `getMainVCS()` instance. Every one of the 20 methods declared on `SyncBridgeMethods` ([`ipc.ts#L24-L56`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/ipc.ts#L24-L56)) needs to start carrying an explicit workspace/project identifier so the main process knows which instance to route to, instead of relying on "whichever one happens to be currently active."
2. **A per-workspace instance registry** in the main process (e.g. a `Map` keyed by `rootDocumentId`/workspace id) that `invokeMainVCS` consults to find-or-create the right instance, replacing the unconditional `getMainVCS()` call.
3. **Renderer call sites.** `window.main.sync.*` is called from **45 call sites across 20 files** (route loaders/actions under `insomnia-sync/*`, `workspace.$workspaceId.tsx`, `workspace.delete.tsx`, `sync-dropdown.tsx`'s consumers, `remote-projects.ts`, `insomnia-sync.ts`, `insomnia-event-stream-context.tsx`, `pull-remote-file.tsx`). Nearly all of them already have the workspace id in scope (from route params or a loaded workspace object), so most individual edits are mechanical, but **every single one must be updated** — and because `sync.invoke` dispatches reflectively with no compile-time whitelist today (see [`invokeMainVCS`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts#L73-L82), which resolves any method name off the VCS instance at runtime), a call with a typo'd or missing identifier would not fail to compile, it would just silently do the wrong thing at runtime. It is worth pairing this migration with adding a proper whitelist so a missed call site fails loudly instead of reintroducing a variant of this same bug.
4. **Three workspace-agnostic methods need a new home.** `localBackendProjects`, `remoteBackendProjects`, and `remoteBackendProjectsOfTeam` never read `_backendProject` at all — they are plain listing queries not tied to any one workspace. They can stay callable on any instance (harmless either way) or be pulled out into standalone functions; either way this needs an explicit decision.
5. **Simplification side-effect.** Once every workspace has its own instance by default, the special-cased "isolated instance so we don't disturb the singleton" logic in `pullRemoteBackendProjectWithSingleton` ([`main/cloud-sync/vcs.ts#L116-L157`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/vcs.ts#L116-L157)) becomes redundant and can be deleted — pulling into a new workspace just uses that workspace's own (about-to-be-created) instance like everything else.

**What does *not* need to change.**

- The `core/vcs.ts` `VCS` class itself — no internal changes needed, only how it is instantiated/looked up.
- The cross-process conflict-resolution plumbing (`AsyncLocalStorage`, `pendingConflictResolutions`, `runWithSyncRenderer`) — this is keyed by the requesting `WebContents`/`handlerId`, not by VCS instance identity, so it keeps working unmodified regardless of how many instances exist.
- The existing unit tests in [`core/__tests__/vcs.test.ts`](https://github.com/Kong/insomnia/blob/cc64ba83c59a6c0fe653e83a20e87bc44719b2d3/packages/insomnia/src/main/cloud-sync/core/__tests__/vcs.test.ts) — they already construct isolated `VCS` instances directly against a `MemoryDriver`, never through the singleton.

## Remediating Already-Corrupted Data (open discussion)

Separately from fixing the root cause, we also need a plan for BackendProjects that are already corrupted today. Two ideas have been raised:

1. Run a one-off server-side scan across BackendProjects to find how many currently have a `rootDocumentId` that does not match the `_id` of the Workspace-type entry in their latest snapshot's state, to quantify the scale of the problem.
2. Have the client automatically detect the mismatch (e.g. during a pull) and self-heal it: create a new snapshot that changes the Workspace document's `_id` to match `rootDocumentId`, then push it automatically.

**(1) is straightforward and should happen regardless of what remediation is ultimately chosen.** No remediation design should be committed to before the scale is known. The scan should additionally classify each affected project by whether the mismatch appears on its very first snapshot (`parent = EMPTY_HASH`) or on a later one — that distinction determines what can actually be recovered, as explained below.

**(2), as an automatic client-side "detect and self-heal by relabeling" step, has real risks and should not be the plan as currently stated:**

- **It does not restore lost data — it relabels someone else's content as the victim's.** As shown in [Reproduction Log Walkthrough](#reproduction-log-walkthrough), the hijacked project's own original documents are not merely mixed into the new snapshot — `getStagable` marks them `deleted: true` and `takeSnapshot` drops them entirely. If the corruption happened on that project's very first snapshot (`parent = EMPTY_HASH`, as in the reproduced case), there is no earlier snapshot to recover the victim's real content from — it is genuinely gone. Renaming the current (wrong) snapshot's Workspace id to match `rootDocumentId` produces a project that now looks internally consistent while still silently containing someone else's content under the victim's name — arguably worse than today's visibly-broken state, since it removes the only signal (an `unsynced` entry, or an obvious id mismatch) that something needs attention.
  - If the corruption instead happened on a *later* snapshot with a clean parent snapshot still present in history, the correct fix for that case is to recover the victim's real content from that last-known-good parent snapshot, not to relabel the corrupted one.
- **"Change the workspace id" is a cascading rename, not a one-field edit.** `SnapshotStateEntry.key` is `doc._id`; changing the Workspace document's `_id` also changes the content (and therefore the blobId) of every direct child whose `parentId` points at it (at minimum the base Environment), so a correct fix has to rewrite that whole subtree consistently, not just relabel one entry.
- **From the merge/diff algorithm's point of view, this is "delete the old workspace, add a new one," not a rename.** Any client that has already pulled the mismatched project — and therefore already has a local workspace under the wrong id — would, on its next pull, see the old id disappear and a new one appear, rather than being quietly renamed. Depending on how many clients have already pulled the bad data, an automatic "corrective" push could produce duplicate or orphaned local workspaces across the fleet, which is a larger blast radius than the original inconsistency.
- **Running this self-heal through the current, still-broken singleton VCS would make it vulnerable to the exact same race described in this document.** A "corrective" `status → stage → takeSnapshot → push` sequence triggered automatically on pull is exactly the same shape of operation that got hijacked in the first place; until the root cause above is fixed, an auto-healing feature built on the same code path could itself get hijacked mid-flight and corrupt a third, unrelated workspace while "fixing" this one.
- **Multiple clients could race to fix the same project independently**, with no coordination mechanism today to prevent two clients from both deciding to push a "corrective" commit for the same BackendProject around the same time.

**Suggested direction (not decided):** run the scan first and use it to classify each affected project as *recoverable* (the mismatch appears after a clean parent snapshot, so the victim's real content can potentially be restored from history) or *unrecoverable* (the mismatch is on the very first snapshot, so the victim's original content was never captured anywhere). Treat remediation as a separate, sequenced effort that ships after — or is fully decoupled from — the root-cause fix above, rather than as an automatic, silent client-side action, at least for a first pass, until the scan's scale and the recoverable/unrecoverable split are known.

