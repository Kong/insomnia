import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import type {
  ElectronApplication,
  Page} from "@playwright/test";
import { test as base } from "@playwright/test";

import { FlowManager } from "../flows/flow-manager";
import { PageManager } from "../pages/page-manager";
import { ACTION_TIMEOUT, DEFAULT_TIMEOUT, MOCK_API_SERVER } from "./constants";
import {
  collectWindowCoverage,
  startWindowCoverage,
} from "./coverage";
import { launchInsomniaElectron, SESSION_ID } from "./launch";
import { closeOpenStepGroup } from "./step-instrumentation";

export * from "./constants";
export { launchInsomniaElectron, SESSION_ID };

/**
 * Toggles misc/mock-api.js's `features.gitSync.enabled` flag, which the app
 * reads once at startup to decide whether the Git project type is offered
 * at all. Must be called from a `test.beforeAll()` (before the `insomnia`
 * fixture launches Electron for the first test in the file) — toggling it
 * mid-session has no effect on an already-running app. Always pair with a
 * matching `test.afterAll(() => setGitSyncFeatureFlag(true))` so later specs
 * aren't affected by a flag this one left disabled.
 *
 * Scoped to this worker's SESSION_ID, so it never affects Electron instances
 * running concurrently in other workers — see SESSION_ID's comment.
 * @param enabled - Whether the Git Sync feature should be enabled
 */
export async function setGitSyncFeatureFlag(enabled: boolean): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/features/git-sync`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, sessionId: SESSION_ID }),
  });
}

/**
 * Toggles misc/mock-api.js's storage-rule `enableGitSync` flag, which the
 * app reads once at startup to decide whether Git projects are disabled by
 * org storage policy. Same pre-launch timing/reset requirements and
 * per-worker scoping as `setGitSyncFeatureFlag()`.
 * @param enabled - Whether the storage rule should allow Git Sync
 */
export async function setGitSyncStorageRule(enabled: boolean): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/storage-rule/git-sync`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, sessionId: SESSION_ID }),
  });
}

/**
 * Toggles misc/mock-api.js's `GET /v1/user/entitlements` response, which the
 * app reads on startup to decide whether the account holds the Konnect
 * control-planes entitlement — the Konnect organization ("Control Planes")
 * only appears in the organization switcher once this (or a local Konnect
 * project) makes it visible. Same pre-launch timing/reset requirements and
 * per-worker scoping as `setGitSyncFeatureFlag()`.
 * @param enabled - Whether the account should hold the Konnect entitlement
 */
export async function setKonnectEntitlement(enabled: boolean): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/features/konnect-entitlement`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, sessionId: SESSION_ID }),
  });
}

/**
 * Resets misc/mock-api.js's Cloud Sync mutable state (new snapshots/blobs,
 * deleted-project ids, "remote has new commit" flag) back to its seeded
 * defaults, scoped to this worker's SESSION_ID — mirrors the isolation
 * `setGitSyncFeatureFlag()` already gets, so this never touches another
 * concurrently-running worker's own Cloud Sync state.
 *
 * The `insomnia` fixture already calls this before every test launches, so
 * a fresh test never inherits a previous one's leftover commits — a spec
 * only needs to call this explicitly if it wants a clean slate mid-test.
 */
export async function resetCloudSyncState(): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID }),
  });
}

/**
 * Stalls `misc/mock-api.js`'s Cloud Sync GraphQL responses for this worker's
 * session by `ms` before replying, until called again with `0` — a test-only
 * concurrency knob (INS-2026), not a real network fault. Unlike the other
 * mock servers' `x-reply-delay-ms` header, these GraphQL calls are made by
 * the app's Electron main process (`insomnia-vcs`'s `runVcsGraphQL`), not the
 * renderer, so there's no request a spec can attach a header to; this holds
 * the *response* instead, from the server side.
 *
 * Pass `projectId` (a backend project's own id, e.g. read from its local
 * `meta.json`) to delay only requests naming that project — as
 * `variables.id`, `.projectId`, or `.teamProjectId`, covering `project`/
 * `branch`/`snapshotsCreate`/`projectCreate` alike — and let every other
 * workspace's calls on the same session through immediately. Omit it (or
 * pass `undefined`) to delay every request for the session instead — but
 * note a workspace's own creation can trigger its own immediate push on the
 * very same session, so an unscoped delay stalls that too (confirmed live: a
 * 6s unscoped delay ballooned an unrelated "New Collection" to ~48s).
 *
 * Use this to widen one workspace's in-flight sync.invoke call (e.g. mid-
 * `push`) long enough to deterministically land a second, concurrent
 * workspace's own sync.invoke call inside that window.
 * `resetCloudSyncState()` does not clear this; call with `0` explicitly once
 * the window is no longer needed.
 * @param ms - How long to hold each matching response, in milliseconds; `0` clears it
 * @param projectId - Only delay requests naming this backend project id; omit to delay every request for the session
 */
export async function setCloudSyncGraphQLDelay(
  ms: number,
  projectId?: string,
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/delay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, ms, projectId }),
  });
}

/**
 * Reads back misc/mock-api.js's log of every Cloud Sync GraphQL request this
 * worker's session has made so far, in arrival order — each entry is
 * `{ operationName, projectId, at }`, where `projectId` is whatever the
 * request actually carried as `variables.id`/`.projectId`/`.teamProjectId`
 * (`null` if none of those were present) and `at` is the server's
 * `Date.now()` when the request arrived (before any `setCloudSyncGraphQLDelay`
 * hold is applied, so it reflects when the app *sent* the request, not when
 * the response resolved).
 *
 * Use this to assert on the actual wire-level shape of a concurrency bug
 * directly — e.g. that every `snapshots`/`blobs` query belonging to one
 * workspace's in-flight pull still carried *that* workspace's own project id
 * throughout, rather than inferring the same thing indirectly from which
 * workspace's on-disk files ended up with new content.
 * `resetCloudSyncState()` clears this along with the rest of the session's
 * Cloud Sync state.
 */
export async function getCloudSyncGraphQLRequestLog(): Promise<
  { operationName: string; projectId: string | null; at: number }[]
> {
  const response = await fetch(
    `${MOCK_API_SERVER}/_admin/cloud-sync/request-log?sessionId=${SESSION_ID}`,
  );
  const { requestLog } = await response.json();
  return requestLog;
}

/**
 * Forces `misc/mock-api.js`'s `projectArchive` GraphQL mutation to return an
 * error instead of succeeding, for this worker's session — a test-only
 * failure knob (INS-2026 case 5) simulating a failed dashboard delete (e.g.
 * offline or revoked access) without an actual network fault. Call with
 * `false` to restore normal success once the failure has been observed.
 * @param enabled - Whether `projectArchive` should fail for this session
 */
export async function setCloudSyncArchiveFailure(
  enabled: boolean,
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/cloud-sync/archive-failure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, enabled }),
  });
}

/**
 * Reads back one of `misc/mock-api.js`'s seeded Cloud Sync fixture projects
 * by name (`"My Collection R1"`, `"My Environment"`, `"My MCP Client"`, or
 * `"Ghost Collection"` — a project pre-seeded with a mismatched
 * `rootDocumentId`, simulating the INS-2026 bug's end state) — its own
 * backend project id, `rootDocumentId`, the `wrk_*` key inside its latest
 * snapshot's `state[]`, and whether it's already been archived this
 * session. Lets a test assert on a *never-pulled* remote file's identity
 * and on-backend state without a local `meta.json` to read.
 * @param name - The fixture project's name
 */
export async function getCloudSyncProjectInfo(name: string): Promise<{
  id: string;
  rootDocumentId: string;
  latestSnapshotWorkspaceKey: string | null;
  deleted: boolean;
}> {
  const response = await fetch(
    `${MOCK_API_SERVER}/_admin/cloud-sync/project-info?sessionId=${SESSION_ID}&name=${encodeURIComponent(name)}`,
  );
  return response.json();
}

/**
 * Resets misc/mock-api.js's Vault Key mutable state (the stored SRP
 * salt/verifier from a prior generate/reset, and any in-flight unlock
 * exchange), scoped to this worker's SESSION_ID — same isolation as
 * `resetCloudSyncState()`. The `insomnia` fixture already calls this before
 * every test launches, so a fresh test never inherits a previous test's
 * vault key from the same worker.
 */
export async function resetVaultState(): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/vault/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID }),
  });
}


export interface UserSession {
  page: Page;
  pageManager: PageManager;
  flowManager: FlowManager;
}

interface Fixtures {
  dataPath: string;
  skipOnboarding: boolean;
  vaultKey: string;
  vaultSalt: string;
  insomnia: ElectronApplication;
  window: Page;
  // A git remote clone URL to hand FlowManager, so specs that need one
  // (e.g. git-sync's) don't have to reimplement the `user` fixture just to
  // thread it through — see git-fixtures.ts, which overrides only this.
  gitCloneUrl: string | undefined;
  user: UserSession;
}

export const test = base.extend<Fixtures>({
  // Its own fixture (rather than a local const inside `insomnia` below) so a
  // spec can override it via `test.extend({ dataPath: async ({ dataPath },
  // use) => { ...seed files into it...; await use(dataPath); } })` to
  // pre-seed NeDB `.db` files before Electron ever launches — mirrors
  // insomnia-smoke-test's own `playwright/test.ts` `dataPath` fixture.
  dataPath: async ({}, use) => {
    const dataPath = path.join(
      os.tmpdir(),
      "insomnia-test",
      crypto.randomUUID(),
    );
    await use(dataPath);
  },

  // Its own fixture so a spec that needs the real v13 onboarding/login
  // flow to render (e.g. a migration test asserting what happens right
  // after onboarding) can override it to `false` — see `insomnia` below
  // for why that becomes an empty string rather than the string "false".
  skipOnboarding: async ({}, use) => {
    await use(true);
  },

  // Its own fixture so a spec can override it via `test.extend({ vaultKey:
  // async ({}, use) => use("<jwk-string>") })` to pre-seed the renderer's
  // `userSession.vaultKey` at launch — bypassing the real generate/enter-key
  // UI flow for a scenario that only needs an already-unlocked vault (Secret
  // KV rows, legacy vault-format environment variables). Left empty, every
  // other spec's Preferences -> Vault Key panel behaves exactly as if no
  // vault key had ever been generated. See `vaultSalt` below and
  // `PLAYWRIGHT_TEST`/`INSOMNIA_VAULT_KEY` in the `insomnia` fixture's env.
  vaultKey: async ({}, use) => {
    await use("");
  },

  // Its own fixture, same shape as `vaultKey` above — pre-seeds
  // `userSession.vaultSalt`, which alone is enough to make Preferences'
  // Vault Key panel show "Enter Vault Key" instead of "Generate Vault Key"
  // (see `pages/preferences.page.ts`'s vault key methods), without needing
  // a `vaultKey` override too. `misc/mock-api.js` runs a real SRP exchange
  // against whatever salt/verifier a spec's own `preferencesFlow` calls
  // establish — this fixture only ever seeds the renderer's *local* belief
  // that a salt exists, not the mock server's stored verifier.
  vaultSalt: async ({}, use) => {
    await use("");
  },

  insomnia: async (
    { dataPath, skipOnboarding, vaultKey, vaultSalt },
    use,
    testInfo,
  ) => {
    // Guarantees every test starts with a clean Cloud Sync slate for this
    // worker's session — without this, a spec that commits/pushes (like
    // discard-commit-push-and-restore.spec.ts) would leak that commit into
    // whichever test this worker runs next.
    await resetCloudSyncState();
    // Same guarantee for Vault Key — without this, a spec that generates or
    // resets a vault key would leak its stored SRP verifier into whichever
    // test this worker runs next.
    await resetVaultState();

    const app = await launchInsomniaElectron({
      dataPath,
      skipOnboarding,
      vaultKey,
      vaultSalt,
    });

    const mainProcessLog: string[] = [];
    app
      .process()
      .stdout?.on("data", (chunk) => mainProcessLog.push(chunk.toString()));
    app
      .process()
      .stderr?.on("data", (chunk) => mainProcessLog.push(chunk.toString()));

    await use(app);

    if (testInfo.status !== testInfo.expectedStatus && mainProcessLog.length) {
      await testInfo.attach("electron-main-process-log", {
        body: mainProcessLog.join(""),
        contentType: "text/plain",
      });
    }

    await app.close();
  },

  window: async ({ insomnia }, use, testInfo) => {
    const win = await insomnia.firstWindow({ timeout: DEFAULT_TIMEOUT });
    await win.waitForLoadState(undefined, { timeout: DEFAULT_TIMEOUT });
    // playwright.config.ts's use.actionTimeout only applies to pages
    // Playwright creates itself — this window comes from a manual
    // electronApp.firstWindow() call, so its default action timeout (30s)
    // has to be raised here explicitly to match.
    win.setDefaultTimeout(ACTION_TIMEOUT);

    await insomnia.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((w) =>
        w.isVisible(),
      );
      mainWindow?.maximize();
    });

    const consoleLog: string[] = [];
    win.on("console", (msg) => {
      consoleLog.push(
        `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}`,
      );
    });

    const networkLog: string[] = [];
    win.on("request", (request) => {
      networkLog.push(
        `[${new Date().toISOString()}] → ${request.method()} ${request.url()}`,
      );
    });
    win.on("requestfinished", async (request) => {
      const response = await request.response();
      networkLog.push(
        `[${new Date().toISOString()}] ← ${response?.status() ?? "?"} ${request.method()} ${request.url()}`,
      );
    });
    win.on("requestfailed", (request) => {
      networkLog.push(
        `[${new Date().toISOString()}] ✗ ${request.method()} ${request.url()} — ${request.failure()?.errorText}`,
      );
    });

    const videoPath = testInfo.outputPath("video.webm");
    await win.screencast.start({ path: videoPath });
    await startWindowCoverage(win);

    await use(win);

    // A test that called AppFlow.restart() already closed this `win` —
    // its screencast can't be stopped, so tolerate that on teardown. Its
    // coverage was already collected by `AppFlow.restart()` itself before
    // tearing it down (see flows/app.flow.ts), so this is a no-op then.
    await collectWindowCoverage(win);
    await win.screencast.stop().catch(() => {});
    if (
      testInfo.status !== testInfo.expectedStatus &&
      fs.existsSync(videoPath)
    ) {
      await testInfo.attach("video", {
        path: videoPath,
        contentType: "video/webm",
      });
      if (consoleLog.length) {
        await testInfo.attach("console-log", {
          body: consoleLog.join("\n"),
          contentType: "text/plain",
        });
      }
      if (networkLog.length) {
        await testInfo.attach("network-log", {
          body: networkLog.join("\n"),
          contentType: "text/plain",
        });
      }
    } else {
      await fs.promises.unlink(videoPath).catch(() => {});
    }
  },

  gitCloneUrl: async ({}, use) => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- `use()` requires its argument; this fixture's value is `string | undefined`
    await use(undefined);
  },

  user: async (
    { window, insomnia, gitCloneUrl, dataPath, skipOnboarding, vaultKey, vaultSalt },
    use,
  ) => {
    const pageManager = new PageManager(window, insomnia);
    const flowManager = new FlowManager(pageManager, insomnia, gitCloneUrl, {
      dataPath,
      skipOnboarding,
      vaultKey,
      vaultSalt,
    });
    await pageManager.workspacePage.navigate();
    await disableFocusModeDefault(flowManager);
    await use({ page: window, pageManager, flowManager });
    await closeOpenStepGroup();
  },
});

// The installed app defaults Settings.sidebarFocusForCollections to true
// (added by INS-2912), which auto-narrows the sidebar to a collection's own
// contents once it's focused — hiding sibling nodes and breaking
// WorkspaceFlow's tree-scan-based lookups (getCollection() etc.) the moment
// a test creates more than one sibling collection. Defaulting it off here
// keeps every pre-existing spec's sidebar behavior unchanged; a spec that
// specifically wants focus mode (e.g.
// tests/workspace/sidebar-focus-mode-onboarding.spec.ts) turns it back on
// itself via preferencesFlow.set({ sidebarFocusForCollections: true }).
// Every `user` fixture (including overrides like git-fixtures.ts's) must
// call this so the default stays consistent across all specs.
export async function disableFocusModeDefault(
  flowManager: FlowManager,
): Promise<void> {
  await flowManager.preferencesFlow.set({
    sidebarFocusForCollections: false,
  });
}

export { expect } from "@playwright/test";
