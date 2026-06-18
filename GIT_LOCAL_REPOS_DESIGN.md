# Git Repositories Anywhere on Disk — Technical Design (SPIKE)

> Status: **Spike / Draft**. Living document — update as decisions are made and implementation lands.
> Owner: James Gatz · Last updated: 2026-06-18

---

## Problem Statement

Today Insomnia stores **every** Git-backed project in a single app-managed location:

```
{INSOMNIA_DATA_PATH || app.getPath('userData')}/version-control/git/{gitRepositoryId}/
```

The path is constructed in three places in
[`git-service.ts`](packages/insomnia/src/main/git-service.ts) — `getGitFSClient()`
(workspace + project branches) and `cloneGitRepoAction()` — by joining
`` `version-control/git/${gitRepositoryId}` `` onto the user-data root.

Consequences of this design:

- The on-disk repo is **hidden** from the user. They can't find it, point other
  Git tooling (CLI, VS Code, GitKraken) at it, or reason about where their work
  lives.
- Users **cannot open a repository they already cloned** elsewhere on their
  machine. The only way to get a repo into Insomnia is to clone it *through*
  Insomnia into the managed folder.
- Users **cannot choose where a newly cloned repo is stored**.

We want to let users **load/store Git repositories from/to anywhere on their
machine**, enabling two new flows:

1. **Open an existing cloned repo** — point Insomnia at a folder that already
   contains a Git repo (and Insomnia YAML files).
2. **Clone into a chosen folder** — pick a destination directory for a new clone.

This is a **spike**: time-boxed exploration whose output is this design doc plus
the UX work required. Implementation can begin incrementally behind this design.

---

## Goals

- A Git project can be backed by a repository at **any user-chosen absolute
  path** on the local filesystem.
- Users can **open an already-cloned repository** (with existing `.git` and
  Insomnia YAML files) without re-cloning.
- Users can **choose a destination directory** when cloning a new repository.
- The **default behavior is unchanged**: repos created without choosing a
  location continue to live in the managed `version-control/git/{id}` folder, so
  existing projects keep working with **zero migration**.
- Cross-platform correctness (macOS, Windows, Linux) for path handling,
  permissions, and the directory picker.
- Clear, safe behavior for the lifecycle edge cases (folder deleted on disk;
  project deleted in app).
- **No new external/runtime dependencies.** The feature must be built entirely
  on existing primitives: `node:fs` / `node:path` in the main process,
  isomorphic-git, the existing native folder picker (`showOpenDialog`), and the
  existing `fs.watch`-based watcher. We explicitly **do not** add a filesystem
  watching library (e.g. `chokidar`) or any other npm package. See [C1](#c1-no-new-dependencies).

### Non-Goals (for this spike / first iteration)

- Native `git` CLI integration — we continue using **isomorphic-git**.
- Multi-root / monorepo support (one Insomnia project ↔ multiple repos).
- Auto-discovery / scanning the filesystem for repos.
- Syncing the *managed* legacy repos to user locations automatically (we offer a
  "reveal in finder" / optional "move" path later, not a forced migration).
- Workspace-scoped (legacy, NeDB-backed) Git Sync. This design targets
  **project-scoped** Git projects, which already store a real working tree on
  disk. Workspace-scoped support is out of scope unless trivially free.

---

## Architecture Overview

### Current (managed-location) flow

```
Project.gitRepositoryId ──► GitRepository (_id)
                                   │
        getGitFSClient(gitRepositoryId)
                                   │
        baseDir = userData/version-control/git/<id>
                                   │
        fsClient(baseDir)  ──►  projectRoutableFSClient
              │                        │
        .git/* → git internals   everything else → working tree (YAML + assets)
                                   │
                        RepoFileWatcher(baseDir) ⇄ NeDB
```

Key components, all of which already accept an arbitrary base directory:

| Component | File | Role |
|---|---|---|
| Path construction (×3) | [`git-service.ts`](packages/insomnia/src/main/git-service.ts) `:379`, `:516`, `:1234` | Builds `version-control/git/<id>` |
| FS wrapper | [`fs-client.ts`](packages/insomnia/src/sync/git/fs-client.ts) | Prefixes `fs.promises` with a base dir |
| Project routing | [`project-routable-fs-client.ts`](packages/insomnia/src/sync/git/project-routable-fs-client.ts) | `.git/*` → internals, rest → working tree |
| Disk ⇄ DB sync | [`repo-file-watcher.ts`](packages/insomnia/src/sync/git/repo-file-watcher.ts) | Imports/exports YAML ↔ NeDB |
| Model | [`git-repository.ts`](packages/insomnia-data/src/models/git-repository.ts) | GitRepository schema |
| Link | [`project.ts`](packages/insomnia-data/src/models/project.ts) | `GitProject.gitRepositoryId` (protected `gr_` id) |
| Directory picker | [`select-file-or-folder.ts`](packages/insomnia/src/ui/utils/select-file-or-folder.ts) → IPC `showOpenDialog` | Native folder dialog (already exists) |

**Critical observation:** every layer downstream of the path string already
takes a `baseDir` parameter. The fixed path is the *only* thing tying repos to
the managed folder. Changing it is a small, well-contained change.

### Proposed flow

Add an optional `directory: string | null` (absolute local path) to the
`GitRepository` model and centralize path resolution:

```ts
// new single source of truth (e.g. in git-service.ts or a small helper module)
function getRepoBaseDir(repo: Pick<GitRepository, '_id' | 'directory'>): string {
  if (repo.directory) {
    return repo.directory; // user-chosen absolute path
  }
  return path.join(
    process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
    `version-control/git/${repo._id}`,
  );
}
```

Then:

- The 3 hard-coded join sites call `getRepoBaseDir(...)` instead.
- Clone destination = `getRepoBaseDir(newRepo)`; for a managed clone `directory`
  is `null`, for a custom clone it's the user-picked folder.
- "Open existing repo" creates a `GitRepository` with `directory` set to the
  chosen folder and `needsFullClone: false` (the working tree already exists),
  then runs the same scan → import path used after a clone.

Nothing else in the FS/watcher stack needs to change because they already
operate on whatever base dir they're handed.

---

## Key Design Decisions

### D1. Store an absolute `directory` on the GitRepository model

- New field `directory: string | null`. `null` ⇒ managed legacy location
  (default, backward compatible). Absolute path ⇒ user location.
- `init()` defaults it to `null`. Old app versions pruning the field on
  `docUpdate` simply revert to managed behavior — acceptable for rollback.
- Single resolver `getRepoBaseDir()` is the **only** code allowed to turn a repo
  into a path. Replaces the 3 inlined joins. This is the linchpin of the change.

### D2. "Open existing repo" = register, don't clone

The "open existing" flow does **not** call `git.clone`. It:

1. Asks the user to pick a folder (native dialog).
2. Validates the folder is a Git repo (`.git` exists / `git.findRoot`
   resolves) and is readable/writable.
3. Scans for Insomnia files (`insomnia.*.yaml`, `.insomnia/`) — reuse the
   existing scan from the shallow-clone preview path so the "select what to
   import" UI is identical.
4. Creates `GitRepository { directory: <path>, uri: <origin remote or ''>,
   needsFullClone: false }` and the `GitProject`, then starts the
   `RepoFileWatcher` on that dir to import YAML → NeDB.

Open question: behavior when the folder has a `.git` but **no** Insomnia files
(empty/unrelated repo) — see Open Questions.

### D3. Default location preserved; no forced migration

Existing repos have `directory: null` and continue resolving to
`version-control/git/<id>`. We do **not** move them. We *may* later offer an
opt-in "Move repository to…" action, but it is not required for v1.

### D4. Lifecycle / ownership semantics (the edge-case decisions)

| Event | Managed repo (`directory: null`) | User repo (`directory: <path>`) |
|---|---|---|
| User **deletes the project in app** | Delete the managed folder (Insomnia owns it) — current behavior | **Do NOT delete the folder.** Only remove the DB records (Project + GitRepository). The user owns the directory; deleting their files is destructive and surprising. Show a confirmation that clarifies the folder stays on disk. |
| User **deletes the folder on disk** | (Rare) repo is broken; surface an error and offer to remove the project | Detect missing/invalid dir on project load or watcher start. **Do not auto-delete the project.** Surface a clear "repository folder not found at `<path>`" state with actions: *Locate folder…* (re-point `directory`) or *Remove project from Insomnia*. |

Rationale: **Insomnia owns the managed folder; the user owns their chosen
folder.** Ownership dictates deletion authority. Auto-deleting a user's
directory or auto-removing a project on a transient missing mount (e.g. external
drive unplugged) would cause data loss / confusion.

### D5. Security & permissions posture

Findings from the spike (see [Spike Findings](#spike-findings--qa) for detail):

- **Arbitrary folder access is acceptable** within Electron's model: the renderer
  never touches `fs` directly; all FS work happens in the **main process**
  (`git-service.ts`) which already has full disk access. We are not widening the
  privilege boundary — only the *target path*.
- **Path must be validated and normalized** in main before use: require an
  **absolute** path, `path.resolve` it, reject paths that don't exist / aren't a
  directory, and reject when we lack RW permission (`fs.access`).
- **Do not let the renderer pass arbitrary paths into FS ops un-vetted.** The
  path enters only via the native `showOpenDialog` (user-consented) or an
  explicit re-locate action, and is validated in main before being persisted.
- **Permission errors are first-class UX**, not crashes: read-only folders,
  protected system locations (macOS TCC: Desktop/Documents/Downloads prompts),
  and OneDrive/Dropbox virtual files must surface actionable errors.
- **Symlinks / network drives**: resolve real path; warn (not block) on network
  paths since isomorphic-git + watcher latency may degrade.

### D6. Keep isomorphic-git (no native git dependency)

Opening a user folder does not require the native `git` binary; isomorphic-git
reads the standard `.git` directory the same way regardless of who cloned it.
This keeps the change contained and avoids a new runtime dependency.

### C1. No new dependencies

This feature ships with **zero new npm packages**. Concretely:

- **Filesystem watching** stays on the existing
  [`repo-file-watcher.ts`](packages/insomnia/src/sync/git/repo-file-watcher.ts),
  which uses native `fs.watch({ recursive: true })` plus a 10 s polling fallback
  — **not** `chokidar`. User-located repos are just a different base dir handed
  to the same watcher; no watching-library upgrade is needed. (Caveat: native
  `fs.watch` recursive support differs by platform — already true today for
  managed repos — so the polling fallback remains our cross-platform safety net.)
- **Folder selection** reuses the existing native dialog via
  [`select-file-or-folder.ts`](packages/insomnia/src/ui/utils/select-file-or-folder.ts)
  → IPC `showOpenDialog` (`properties: ['openDirectory']`). No new picker.
- **Path / permission / validation** logic uses `node:path` and `node:fs`
  (`path.resolve`, `fs.access`, `fs.stat`) only.
- **Git operations** stay on isomorphic-git (see D6).

If any task appears to need a new dependency, that's a signal the approach is
wrong — stop and reassess against this constraint rather than adding the package.

### D7. Path storage is absolute, displayed friendly

Persist absolute paths (cross-machine portability is not a goal — these are
local-only). For display, collapse `$HOME` to `~`. Document that moving the app
to another machine won't carry the path (expected for local repos).

---

## Spike Findings — Q&A

### Security

- **How safe is opening any folder as a Git project?** Acceptable. The FS
  boundary is unchanged: only the main process does disk I/O, and the path is
  user-consented via the native dialog. Residual risk is user-error (pointing at
  the wrong folder), mitigated by validation + the "no auto-delete" rule (D4).
- **File-permission issues?** Yes, expected and must be handled: read-only dirs,
  macOS TCC-protected locations (Desktop/Documents/Downloads/iCloud), Windows
  ACLs, and cloud-sync placeholder files (OneDrive/Dropbox "online-only").
  Mitigation: `fs.access(dir, R_OK | W_OK)` pre-check + typed, actionable error
  surfaces. Never silently fail a commit/checkout.

### UX

- **How do users decide where to store a new repo?** Add a destination-folder
  step to the clone flow (native folder picker, with a sensible default like
  `~/Insomnia` or last-used dir). Defaulting to managed location stays available
  as "let Insomnia manage it."
- **How does "open in folder" work across OSs?** Use the existing
  `showOpenDialog` (IPC) with `properties: ['openDirectory']`. Native picker on
  all three platforms; normalize separators via `path` in main.
- **How do users open an existing repo?** New entry in the "New Project" → Git
  flow: *"Open existing repository on disk"*, alongside *Clone* and *Connect
  later*. Pick folder → validate → scan → import.

### Edge cases

- **User deletes the repo folder on disk** → see D4. Detect, surface, never
  auto-delete the project; offer *Locate* / *Remove*.
- **User deletes the project in app** → see D4. Managed: delete folder. User
  location: keep folder, remove DB records only, with a clarifying confirm.
- **Folder on an unmounted external/network drive** → treat as transient
  "unavailable", not deleted. Same surface as missing folder; re-validate when
  it returns.

### Other / additional risks surfaced

- **Two projects pointing at the same folder** — detect and prevent (or warn):
  query existing `GitRepository.directory` for collisions before create.
- **Watcher fan-out** — many user folders in disparate locations means many
  native `fs.watch` instances (no library change — see [C1](#c1-no-new-dependencies));
  confirm the watcher registry scales and that `node_modules`/large sibling dirs
  in a chosen folder don't get walked/watched (scope to the repo working tree +
  ignore patterns). User-chosen folders are more likely than the managed folder
  to contain large unrelated trees, so this matters more here.
- **Folder that is a Git repo but has unrelated/huge content** — importing only
  Insomnia files is correct, but committing through Insomnia could stage
  unrelated files. Confirm `.gitignore`/staging scope is limited to Insomnia
  artifacts.
- **Legacy `version-control/git/<id>/other` layout** — only relevant to managed
  repos; user repos use the root working-tree layout. Ensure
  `repoMigrationVersion` logic doesn't try to migrate user folders.

---

## Optimizations and Improvements

- **Single path resolver (`getRepoBaseDir`)** removes 3 duplicated joins —
  a refactor worth doing regardless of this feature, and it de-risks future
  path changes.
- **Reuse the shallow-clone scan UI** for "open existing" so the import-selection
  UX is identical across clone and open flows (less surface area, consistent UX).
- **"Reveal in Finder/Explorer" action** on Git projects — cheap win once repos
  live in user-visible locations; uses `shell.showItemInFolder`.
- **Last-used-directory memory** for the clone destination picker.
- **Health badge** on Git projects whose `directory` is currently missing/
  unavailable, with one-click *Locate*.
- **Optional later: "Move to folder…"** for migrating managed repos into a
  user-chosen location (copy + repoint `directory` + delete old managed dir).
- **Collision guard** index on `directory` to make duplicate-folder detection
  cheap.

---

## Implementation Plan (incremental, behind this design)

1. **Model + resolver (foundation).** Add `directory: string | null` to
   `GitRepository` (`init()` → `null`). Introduce `getRepoBaseDir()` and replace
   the 3 hard-coded joins in `git-service.ts`. No behavior change yet
   (everything resolves to managed dir). Ship + verify regression-free.
2. **Clone-to-chosen-folder.** Add destination picker to the clone flow; pass the
   chosen path into the new `GitRepository.directory`; validate in main.
3. **Open-existing-repo.** New project-creation entry; folder picker → validate
   (`.git` + RW) → reuse scan → create repo/project with `needsFullClone: false`
   → start watcher.
4. **Lifecycle & errors.** Implement D4 deletion semantics + missing-folder
   detection/surface + *Locate*/*Remove* actions + permission error surfaces.
5. **Polish.** Reveal-in-folder, last-used dir, collision guard, health badge.

Each step is independently shippable; steps 2–3 can ship behind a feature flag.

### Known remaining path-construction sites

Step 1 centralizes the main-process path through `getRepoBaseDir()`. One
**renderer-side** site still builds the managed path inline and must be threaded
with the repo's `directory` before custom locations ship:

- [`...workspace.$workspaceId.spec.tsx:105`](packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.tsx#L105)
  builds `gitSyncRulesetPath` as
  `window.app.getPath('userData')/version-control/git/{id}/.spectral.yaml`.
  Correct only for managed repos (`directory: null`). When custom directories
  land, the loader must resolve the repo's `directory` (e.g. via an IPC/loader
  value) instead of assuming `userData`. Tracked for step 2/3.

---

## Open Questions

- **OQ1.** "Open existing" against a repo with a `.git` but **no** Insomnia files
  — block, or allow and treat as an empty Insomnia project we initialize into?
- **OQ2.** Should we support **non-Git** existing folders (init a fresh repo in a
  user folder), or strictly require an existing `.git`?
- **OQ3.** Default destination for new clones — `~/Insomnia`, last-used, or force
  an explicit pick every time?
- **OQ4.** Do we support **workspace-scoped (legacy)** Git Sync for user
  locations, or project-scoped only (current assumption)?
- **OQ5.** Collision policy when two projects target the same folder — hard block
  or warn-and-allow?
- **OQ6.** Behavior on transient unavailability (unmounted drive) vs. true
  deletion — how long/loud before we prompt the user?

---

## Appendix — Affected Code (current)

- Path construction: [`git-service.ts:379`](packages/insomnia/src/main/git-service.ts#L379),
  [`:516`](packages/insomnia/src/main/git-service.ts#L516),
  [`:1234`](packages/insomnia/src/main/git-service.ts#L1234)
- FS wrapper: [`fs-client.ts`](packages/insomnia/src/sync/git/fs-client.ts)
- Routing: [`project-routable-fs-client.ts`](packages/insomnia/src/sync/git/project-routable-fs-client.ts)
- Watcher: [`repo-file-watcher.ts`](packages/insomnia/src/sync/git/repo-file-watcher.ts)
- Model: [`git-repository.ts`](packages/insomnia-data/src/models/git-repository.ts)
- Project link: [`project.ts`](packages/insomnia-data/src/models/project.ts)
- Clone routes: [`git.init-clone.tsx`](packages/insomnia/src/routes/git.init-clone.tsx),
  [`git.clone.tsx`](packages/insomnia/src/routes/git.clone.tsx)
- Project creation: [`organization.$organizationId.project.new.tsx`](packages/insomnia/src/routes/organization.$organizationId.project.new.tsx)
- Folder picker: [`select-file-or-folder.ts`](packages/insomnia/src/ui/utils/select-file-or-folder.ts),
  IPC [`electron.ts`](packages/insomnia/src/main/ipc/electron.ts) `showOpenDialog`
- Create form UI: [`project-create-form.tsx`](packages/insomnia/src/ui/components/project/project-create-form.tsx),
  [`git-repo-form.tsx`](packages/insomnia/src/ui/components/project/git-repo-form.tsx)
