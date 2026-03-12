# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About Insomnia

Insomnia is an open-source, cross-platform API client for GraphQL, REST, WebSockets, SSE, gRPC and other HTTP protocols. It's built on Electron with a React frontend.

## Development Commands

**Prerequisites:**

- Node.js version: `22.20.0` (see `.nvmrc`)
- npm >= 10

**Setup:**

```bash
npm i
```

**Development:**

```bash
npm run dev              # Start app with live reload
npm run dev:autoRestart  # Start with both renderer live reload and main process auto-restart
```

**Code Quality:**

```bash
npm run lint             # Run linting across all workspaces
npm run type-check       # Run TypeScript type checking across all workspaces
npm test                 # Run tests across all workspaces
```

**Building:**

```bash
npm run app-build        # Build the app
npm run app-package      # Package the app for distribution
```

**Inso CLI Development:**

```bash
npm run inso-start       # Start Inso CLI in watch mode
npm run inso-package     # Build and package Inso CLI
./packages/insomnia-inso/bin/inso -v  # Run Inso CLI locally
```

**Testing:**

```bash
# Smoke tests
npm run test:smoke:dev       # Run smoke tests in dev mode
npm run test:smoke:build     # Run smoke tests on built app
npm run test:smoke:package   # Run smoke tests on packaged app

# Critical tests
npm run test:crit:dev        # Run critical tests in dev mode
npm run test:crit:package    # Run critical tests on packaged app
```

**Package-specific commands:**

```bash
npm run <script> -w insomnia              # Run script in main insomnia package
npm run <script> -w insomnia-inso         # Run script in inso CLI package
npm run <script> -w insomnia-smoke-test   # Run script in smoke test package
```

## Repository Structure

This is a monorepo using npm workspaces:

- **`packages/insomnia`**: Main Electron application
- **`packages/insomnia-inso`**: CLI tool that reuses logic from the main app
- **`packages/insomnia-testing`**: Testing utilities
- **`packages/insomnia-api`**: API client for Insomnia backend services
- **`packages/insomnia-smoke-test`**: End-to-end Playwright tests
- **`packages/insomnia-scripting-environment`**: Scripting environment for request execution

## Main Package Architecture (`packages/insomnia`)

### Key Directories

- **`entry.main.ts`**: Entry point for the Electron application
- **`src/main/`**: Main process code (window management, updates, analytics, IPC handlers)
- **`src/ui/`**: React components, routes, hooks, and Tailwind styling
- **`src/common/`**: Shared code between main and renderer processes (database, constants)
- **`src/models/`**: Data models and database schema (requests, workspaces, environments, etc.)
- **`src/sync/`**: Synchronization logic (Git Sync, Cloud Sync, Local Vault)
- **`src/network/`**: HTTP client logic and authentication (OAuth, etc.)
- **`src/templating/`**: Nunjucks template rendering
- **`src/plugins/`**: Plugin installation and usage

### Data Models

All data models are in `src/models/`. Each file defines:

- Type definitions
- Database schema
- CRUD operations for that model type

The `src/models/index.ts` consolidates all models and provides utility functions.

### State Management & Routing

- **No Redux**: The app has migrated away from Redux to React Router
- **React Router**: Uses file-based routing in `src/routes/`
  - Dynamic segments: `organization.$organizationId.project.$projectId._index.tsx`
  - `loader`/`clientLoader`: Fetch data from database
  - `action`/`clientAction`: Handle mutations
- **Database**: NeDB (in-memory/file-based) accessed via `src/common/database.ts`

## Synchronization Architecture

Three storage backends are supported:

### 1. Local Vault

- Data stored locally in NeDB database
- No cloud sync

### 2. Git Sync

- Implementation: `src/sync/git/`
- Uses `isomorphic-git` library
- Core logic: `git-vcs.ts` (clone, push, pull, commit operations)
- Virtual filesystem in Electron

### 3. Cloud Sync

- Implementation: `src/sync/vcs/vcs.ts`
- Syncs to Insomnia's cloud backend via API
- Handles merging and conflict resolution
- Supports end-to-end encryption

Common types: `src/sync/types.ts` (Snapshot, Branch, MergeConflict, etc.)

## Technical Stack

- **Framework**: Electron 38.4.0 + React 18
- **UI**: React components with Tailwind CSS 4 and react-aria
- **Routing**: React Router 7 (file-based routing)
- **HTTP Client**: libcurl via `@getinsomnia/node-libcurl` (for deep HTTP control)
- **Database**: NeDB (`@seald-io/nedb`)
- **Code Editor**: CodeMirror 5 and Monaco Editor
- **Testing**: Vitest (unit tests) + Playwright (e2e tests)
- **Build**: esbuild + Electron Builder
- **Styling**: Tailwind CSS 4 with react-aria components

## Testing

### Unit Tests

- Located alongside the file under test: `src/common/__tests__/database.test.js`
- Uses Vitest
- Run with `npm test`

### Smoke Tests

- Located in `packages/insomnia-smoke-test`
- Uses Playwright
- Tests both built and packaged versions

## IPC Communication

Main process and renderer process communicate via Electron IPC:

- Handlers registered in `src/main/ipc/`
- Used for accessing Node.js APIs from renderer

## Important Technical Notes

### Known Technical Debt

- NeDB is unmaintained but deeply integrated (migration planned)
- CodeMirror 5 is unmaintained
- Sync code needs refactoring
- Template rendering needs cleanup
- `apiconnect-wsdl` has restrictive engine config - after `npm install`, the package-lock is manually edited

### Native Modules

- `@getinsomnia/node-libcurl` requires special handling
- Must be rebuilt for Electron: `npm run install-libcurl-electron`
- Platform-specific builds can be challenging (Windows, Mac, Linux)

### Inso CLI Architecture

The CLI (`insomnia-inso`) reuses logic from the main app:

1. Imports from `insomnia` and `insomnia-testing` packages
2. Transpiled to CommonJS with esbuild
3. Packaged as executable with `pkg`
4. Note: Currently bundles almost entire renderer (includes React components despite being Node-only)

## Working with Data Models

When modifying data models:

1. Update the model file in `src/models/`
2. Update TypeScript types
3. Consider migration logic if schema changes
4. Update sync logic if the model is synced

## Electron Upgrades

When upgrading Electron:

1. Update `.npmrc`
2. Update `.nvmrc`
3. Update `packages/insomnia/package.json` (electron and node-libcurl versions)
4. Update `shell.nix`
5. Test native module compatibility

## Branch Strategy

- Main development branch: `develop`
- Create PRs against `develop`
