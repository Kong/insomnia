# AGENTS.md

## Tech Stack

- **UI:** React with React Router (loaders/actions pattern)
- **Components:** React Aria Components
- **Desktop Shell:** Electron (main + renderer processes)
- **Styling:** TailwindCSS
- **Language:** TypeScript
- **Database:** NeDB (`@seald-io/nedb`) — embedded NoSQL
- **Build/Dev:** Vite, npm workspaces monorepo

_See `package.json` for current versions and `.nvmrc` for the Node version._

## Strict Rules

- **No unsolicited formatting.** Rely on ESLint/Prettier. Do not reformat existing code.
- **Strict scoping.** Only modify code directly related to the prompt. Do not refactor adjacent code unless asked.

## Command Output

Prefer quiet command variants to minimise output volume:

- `git log --oneline -20` not `git log`
- `git diff --stat` not `git diff`
- `npm test --silent` not `npm test`
- `tsc --noEmit 2>&1 | head -50` for type-check failures
- Use the `Read` tool with `limit` rather than `cat` on large files
- Use `Grep` with `head_limit` rather than unrestricted searches

## Validation Commands

Run from repo root before considering work complete:

```bash
npm run lint          # ESLint all workspaces
npm run type-check    # TypeScript check all workspaces
npm test              # Tests all workspaces (or: npm test -w packages/insomnia)
npm run check-cycle-references   # Fails on new circular imports not in the baseline
```

## Worktree Setup

- New git worktrees may not have `node_modules` yet. Before installing or validating, switch to the repo's required runtime from the worktree root:

```bash
fnm use "$(cat .nvmrc)"
node -v
npm -v
```

- This repo expects the `.nvmrc` Node version and npm 11+. If `fnm` is unavailable, manually use an equivalent Node/npm version before running any `npm` commands.
- After switching versions in a fresh worktree, install dependencies from repo root with `npm ci`.
- Do **not** use `npm ci --ignore-scripts` for normal worktree setup. It leaves Electron partially installed, which later breaks builds, renderer import checks, and other validation commands.

## Repository Structure

`packages/`
`insomnia/` ← Main Electron app
`src/`
`common/` ← Shared utils, settings types, `app-data.ts` (DB-synced query keys)
`routes/` ← React Router files (clientLoader/clientAction)
`ui/` ← React components, hooks, `insomnia-fetch.ts`
`main/` ← Electron IPC handlers, `preload.ts`
`plugins/` ← Plugin install/usage (loaded in a dedicated hidden BrowserWindow, see `entry.plugin-window.ts`)
`scripting/` ← Pre-request/after-response script execution
`konnect/` ← Kong Konnect integration
`account/` ← Auth, session, encryption
`sync/` ← Git/VCS sync
`network/` ← Request execution engine
`templating/` ← Nunjucks rendering (Web Worker)
`insomnia-data/` ← Data models (`src/`), services + NeDB implementation (`node-src/`), shared data utilities
`insomnia-api/` ← Cloud API client
`insomnia-inso/` ← CLI tool
`insomnia-testing/` ← Test framework
`insomnia-scripting-environment/` ← Scripting API objects (`insomnia.*` / `pm.*`) used by script execution
`insomnia-vcs/` ← Insomnia VCS (team sync) functionality
`insomnia-analytics/` ← Shared analytics client (desktop app + CLI)
`insomnia-smoke-test/` ← Playwright E2E tests
`insomnia-test/` ← Shared Playwright page objects/components for E2E tests
`insomnia-component-docs/` ← Component docs (not an npm workspace)

Project skills live in `.claude/skills/` (`write-insomnia-test`, `fix-scripting-feature`, `fix-test-cli-ci`, `manage-ai-plugins`, `component-docs`). Use them for matching tasks. See also `DEVELOPMENT.md`.

## Data Model Hierarchy

Organization
→ Project (local | remote/cloud | git-backed)
→ Workspace (scope: 'collection' | 'design')
→ Base Environment (auto-created: use `services.environment.getOrCreateForParentId(workspaceId)`)
→ Sub-Environments
→ Cookie Jar (auto-created)
→ Request Group (folders)
→ Request (HTTP, GraphQL, gRPC, WebSocket, Socket.IO)
→ Request (can be direct child of workspace)
**Note:** A Workspace with `scope: 'collection'` IS the collection.

## Key Patterns

- **Data Queries & Mutations (migrating to TanStack Query):** Data hooks are grouped per domain in `src/ui/hooks/data/use-<domain>.ts` (new hooks go here; older ones such as `use-organization-data.ts`, `use-workspace-data.ts` and `use-account-server-data.ts` still sit flat in `src/ui/hooks/`). Each file holds the domain's query hook(s) and its mutation hooks (e.g. `useCloudCredentials`, `useCreateCloudCredential`). Query-key factories for DB data kept fresh by `updateAppDataOnDbChanges` live in `src/common/app-data.ts` (e.g. `cloudCredentialKeys`) and are imported by the hook; keys for other data (e.g. server data) can live in the hook file. Shared helpers live next to `use-query.ts` (`useDBQuery` / `useDBQueries` / `useServerQuery` / `useServerQueries`) and `use-mutations.ts` (`useDBMutation` / `useInvalidatingDBMutation` / `useServerMutation`). Never call bare `useQuery` / `useMutation`: the app has two query clients (local DB, server) and the wrappers bind the correct one.
  - **Client defaults:** the DB client (`AppDataCacheProvider`) uses `staleTime`/`gcTime: Infinity`, `retry: false`, `networkMode: 'always'` and is push-based (`db.changes`). The server client (`ServerDataCacheProvider`) uses `retry: 2` and the default `staleTime: 0`, so it is pull-based: refetch on key change/mount. Scope server query keys by the account/organization id.
  - **Logout:** `root.tsx` reloads the renderer when a signed-in session ends, so both query clients (and other in-memory state) are reset. Don't add manual `queryClient.clear()` for logout.
  - Do not add new `clientAction`s for data mutations. Existing `clientAction`s stay until migrated.
  - Local DB data covered by `updateAppDataOnDbChanges` (`src/common/app-data.ts`) is refreshed from `db.changes` automatically, so don't invalidate it manually. For DB data it does not cover, use `useInvalidatingDBMutation` with `invalidates`, and set `staleTime: 0` on the query if the data can also change outside these hooks (the DB client defaults to `staleTime: Infinity`, and `initialData` would then suppress the first fetch, so avoid it). Server mutations: invalidate via keys from the matching key factory.
  - Bulk DB writes inside `mutationFn` must still be buffered (see Database Buffering).
  - Unlike `clientAction`, mutations do not block navigation, so use them for long-running operations.
  - If the feature leans heavily on router loader data, review whether to keep `loader`/`clientAction` instead: TanStack mutations do not trigger React Router's automatic loader revalidation.
  - **Migration checklist (when replacing a `clientAction`):** everything that read the affected data relied on revalidation, so find every consumer before deleting the route. That includes `useRootLoaderData`/`useLoaderData` reads, and also effects, memos or state snapshots keyed on loader-derived values (e.g. a `useCallback` depending on `props.workspace` that reloads data when the loader refreshes). Move those readers to the query hook, drop the field from the loader and its `*LoaderData` type, and update tests that mock the loader hook.
  - React to completion with per-call `mutate(vars, { onSuccess })` / `mutateAsync`, not a `useEffect` watching `mutation.data`.
  - **Provider scope:** `ServerDataCacheProvider` > `AppDataCacheProvider` wrap everything in `root.tsx`, including `<Modals />`, so DB/server hooks work anywhere there. They do not work in `Layout`, `ErrorBoundary` or `HydrateFallback`, nor in the component that renders the providers: `Root` is a thin wrapper around `RootContent` for that reason, so don't inline the providers back into `RootContent`'s JSX.
- **Route-Based Actions (legacy):** Existing mutations use React Router's `clientAction` (`src/routes/`). `clientAction` blocks navigation.
- **Database Buffering:** Always buffer bulk writes (`database.bufferChangesIndefinitely()`, then `flushChanges()`). Unbuffered writes fire UI revalidation per operation, causing severe lag.
- **State Management:** Router loaders and NeDB for persistent state, TanStack Query for the renderer data cache and mutations. Use React `useState`/context for ephemeral UI state (No Redux/Zustand).
- **Electron IPC:** For main↔renderer communication, define handlers in `src/main/ipc/`, expose in `src/main/preload.ts`, and update `window.main` in `src/global.d.ts`.
- **Templates:** Nunjucks runs in a Web Worker (`src/templating/`). Use `{{ _.variable_name }}`.
- **Models & Services:** `models.<type>` (`insomnia-data`) holds schemas, type guards, constants and `init`. Data access goes through `services.<domain>` (e.g. `services.workspace.getById()`, `create()`, `update()`, `remove()`), implemented in `packages/insomnia-data/node-src/services/` (follow `CONVENTIONS.md` there when adding methods). In the renderer, calls are proxied over IPC to the main process (`src/ui/services-proxy.ts`); `src/ui/database.client.ts` bridges the raw `database` via `window.database.invoke`.
- **HTTP Calls:** Use `insomniaFetch()` for Insomnia backend APIs. Use plain `fetch()` for external/third-party APIs.
- **Styling:** Tailwind utility classes only. Use `clsx`/`tailwind-merge` for conditionals. Use React Aria for interactive HTML elements.
- **Testing:** Use **Vitest** (unit) and **Playwright** (E2E). Co-locate unit tests as `filename.test.ts`. Use `vi.mock()`. Prefer testing logic via loaders over mounting components.
- **E2E tests** live in `packages/insomnia-smoke-test/`. Full docs: [`packages/insomnia-smoke-test/README.md`](packages/insomnia-smoke-test/README.md).
- Run E2E from repo root: `npm run test:smoke:dev` (filter: `npm run test:smoke:dev -- <title-substring>`).
- New test imports: `import { test } from '../../playwright/test'` and `import { expect } from '@playwright/test'`.

## Sensitive Data

- **Vault system (AES-GCM):** For environment secrets (`EnvironmentKvPairDataType.SECRET`).
- **Electron safeStorage:** Platform-native encryption (`window.main.secretStorage`).
