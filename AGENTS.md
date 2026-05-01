# AGENTS.md

## Tech Stack
- **UI:** React with React Router (loaders/actions pattern)
- **Components:** React Aria Components
- **Desktop Shell:** Electron (main + renderer processes)
- **Styling:** TailwindCSS
- **Language:** TypeScript
- **Database:** NeDB (`@seald-io/nedb`) — embedded NoSQL
- **Build/Dev:** Vite, npm workspaces monorepo

*See `package.json` for current versions and `.nvmrc` for the Node version.*

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
```

## Repository Structure
`packages/`
  `insomnia/`                ← Main Electron app
    `src/`
      `common/`              ← Shared utils, settings types
      `models/`              ← Data model definitions
      `insomnia-data/`       ← Model defaults, init(), NeDB db implementation, business logic
      `routes/`              ← React Router files (clientLoader/clientAction)
      `ui/`                  ← React components, hooks, `insomnia-fetch.ts`
      `main/`                ← Electron IPC handlers, `preload.ts`
      `account/`             ← Auth, session, encryption
      `sync/`                ← Git/VCS sync
      `network/`             ← Request execution engine
      `templating/`          ← Nunjucks rendering (Web Worker)
  `insomnia-api/`            ← Cloud API client
  `insomnia-inso/`           ← CLI tool
  `insomnia-testing/`        ← Test framework

## Data Model Hierarchy
Organization
  → Project (local | remote/cloud | git-backed)
    → Workspace (scope: 'collection' | 'design')
      → Base Environment (auto-created: use `models.environment.getOrCreateForParentId(workspaceId)`)
        → Sub-Environments
      → Cookie Jar (auto-created)
      → Request Group (folders)
        → Request (HTTP, GraphQL, gRPC, WebSocket, Socket.IO)
      → Request (can be direct child of workspace)
**Note:** A Workspace with `scope: 'collection'` IS the collection.

## Key Patterns
- **Route-Based Actions:** Mutations use React Router's `clientAction` (`src/routes/`).
  - **CRITICAL:** `clientAction` blocks navigation. For long-running UI operations, use plain async functions instead.
- **Database Buffering:** Always buffer bulk writes (`database.bufferChangesIndefinitely()`, then `flushChanges()`). Unbuffered writes fire UI revalidation per operation, causing severe lag.
- **State Management:** Use Router loaders/actions and NeDB for persistent state. Use React `useState`/context for ephemeral UI state (No Redux/Zustand).
- **Electron IPC:** For main↔renderer communication, define handlers in `src/main/ipc/`, expose in `src/main/preload.ts`, and update `window.main` in `src/global.d.ts`.
- **Templates:** Nunjucks runs in a Web Worker (`src/templating/`). Use `{{ _.variable_name }}`.
- **Models:** Follow CRUD via `models.<type>` (e.g., `create()`, `update()`).
- **HTTP Calls:** Use `insomniaFetch()` for Insomnia backend APIs. Use plain `fetch()` for external/third-party APIs.
- **Styling:** Tailwind utility classes only. Use `clsx`/`tailwind-merge` for conditionals. Use React Aria for interactive HTML elements.
- **Testing:** Use **Vitest** (unit) and **Playwright** (E2E). Co-locate unit tests as `filename.test.ts`. Use `vi.mock()`. Prefer testing logic via loaders over mounting components.
- **E2E tests** live in `packages/insomnia-smoke-test/`. Full docs: [`packages/insomnia-smoke-test/README.md`](packages/insomnia-smoke-test/README.md).
- Run E2E from repo root: `npm run test:smoke:dev` (filter: `npm run test:smoke:dev -- <title-substring>`).
- New test imports: `import { test } from '../../playwright/test'` and `import { expect } from '@playwright/test'`.

## Sensitive Data
- **Vault system (AES-GCM):** For environment secrets (`EnvironmentKvPairDataType.SECRET`).
- **Electron safeStorage:** Platform-native encryption (`window.main.secretStorage`).
## cx — Semantic Code Navigation

Prefer cx over reading files. Escalate: overview → symbols → definition/references → Read tool.

### Quick reference

```
cx overview PATH                                    file or directory table of contents
cx overview DIR --full                              directory overview with signatures
cx symbols [--kind K] [--name GLOB] [--file PATH]   search symbols project-wide
cx symbols --kinds [--file PATH]                     list distinct kinds with counts
cx definition --name NAME [--from PATH] [--kind K]  get a function/type body
cx references --name NAME [--file PATH] [--unique]   find all usages (--unique: one per caller)
cx lang list                                         show supported languages
cx lang add LANG [LANG...]                           install language grammars
```

Aliases: `cx o`, `cx s`, `cx d`, `cx r`

Kinds: fn, struct, enum, trait, type, const, class, interface, module, event

### Key patterns

- Start with `cx overview .`, drill into subdirectories — cheaper than ls + reading files
- `cx definition --name X` gives exact text for Edit tool's `old_string` without reading the whole file
- `cx references --name X --unique` shows one row per caller — use before refactoring to check blast radius
- After context compression, use `cx overview` / `cx definition` to re-orient — don't re-read full files
- Check signatures for `pub`/`export` to identify public API without reading the file

### Pagination

Default limits: definition 3, symbols 100, references 50. When truncated, stderr shows:

```
cx: 3/32 definitions for "X" | --from PATH to narrow | --offset 3 for more | --all
```

`--offset N` pages forward, `--all` bypasses, `--limit N` overrides. Narrowing with `--from`/`--file`/`--kind` is usually better than paging.

JSON: paginated → `{total, offset, limit, results: [...]}`, non-paginated → bare array.

### Missing grammars

If cx reports a missing grammar, install with `cx lang add <lang>`. Run `cx lang list` to see what's installed.
