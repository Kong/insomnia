import { spawn } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import type {
  ElectronApplication,
  Page} from "@playwright/test";
import {
  _electron as electron,
  test as base,
} from "@playwright/test";

import { FlowManager } from "../flows/flow-manager";
import { PageManager } from "../pages/page-manager";
import { closeOpenStepGroup } from "./step-instrumentation";

export const DEFAULT_TIMEOUT = 60_000;

/**
 * By default, the `insomnia` fixture below launches the app straight out of
 * the sibling `../insomnia` source checkout (its local `electron` binary
 * against `packages/insomnia`, renderer served by the Vite dev server
 * `playwright.config.ts` starts under this same condition) instead of a
 * packaged build — so the app under test always reflects whatever's
 * currently checked out there, not whichever build happened to get
 * installed last. Opts out automatically whenever `INSOMNIA_BINARY` is set
 * (CI always sets it — see `.github/workflows/playwright.yml`), or
 * explicitly via `INSOMNIA_DEV_MODE=false`/`0` to fall back to the packaged
 * `/Applications/Insomnia.app` build locally without pointing at a specific
 * binary.
 */
const INSOMNIA_DEV_MODE =
  !process.env.INSOMNIA_BINARY &&
  process.env.INSOMNIA_DEV_MODE !== "false" &&
  process.env.INSOMNIA_DEV_MODE !== "0";
const INSOMNIA_SRC_PACKAGE = path.resolve(
  __dirname,
  "..",
  "..",
  "insomnia",
  "packages",
  "insomnia",
);

/**
 * Runs the same one-shot `esbuild.entrypoints.ts` dev build `npm run
 * start:electron` does, compiling the main/preload bundles into
 * `packages/insomnia/src` so the local `electron` binary has something to
 * load. Cached at module scope — `playwright.config.ts` pins `workers: 1`,
 * so every test in the run shares this one build rather than re-running it
 * per test.
 */
let insomniaDevBuild: Promise<void> | undefined;
function ensureInsomniaDevBuild(): Promise<void> {
  if (!insomniaDevBuild) {
    insomniaDevBuild = new Promise((resolve, reject) => {
      const child = spawn(
        "npx",
        ["cross-env", "NODE_ENV=development", "esr", "esbuild.entrypoints.ts"],
        { cwd: INSOMNIA_SRC_PACKAGE, stdio: "inherit", shell: true },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `Building insomnia's dev entrypoints failed (exit ${code})`,
              ),
            ),
      );
    });
  }
  return insomniaDevBuild;
}

/**
 * Base URLs for every local mock server started by `playwright.config.ts`'s
 * `webServer` array. One constant per server/scheme pair — import the exact
 * ones a spec needs instead of hardcoding `localhost:<port>` inline, so a
 * port change only has to happen here.
 */
export const MOCK_API_SERVER = "http://localhost:4010";
export const MOCK_LLM_SERVER = `${MOCK_API_SERVER}/mock-llm`;

export const HTTP_SERVER = "http://localhost:4060";
export const HTTP_SERVER_HTTPS = "https://localhost:4061";
export const HTTP_SERVER_CUSTOM_CA_HTTPS = "https://localhost:4062";
export const HTTP_SERVER_MTLS = "https://localhost:4063";

export const EVENT_STREAM_SERVER = "http://localhost:4050";
export const EVENT_STREAM_SERVER_HTTPS = "https://localhost:4051";

export const WS_SERVER = "ws://localhost:4040";
export const WS_SERVER_WSS = "wss://localhost:4041";

export const SOCKET_SERVER = "ws://localhost:3000";
export const SOCKET_SERVER_WSS = "wss://localhost:3001";

export const MCP_SERVER = "http://localhost:4020/mcp";
export const MCP_SERVER_HTTPS = "https://localhost:4021/mcp";

export const GRPC_SERVER = "localhost:9000";
export const GRPC_SERVER_TLS = "grpcs://localhost:9001";
export const GRPC_SERVER_MTLS = "grpcs://localhost:9002";

export const GIT_SERVER = "http://localhost:4070";

/**
 * Fixed test credentials `misc/oauth2-server.js` accepts for its
 * Authorization Code / Implicit / Client Credentials / Resource Owner
 * Password grants — mirror any change here into that file.
 */
export const OAUTH2_SERVER = "http://localhost:4080";
export const OAUTH2_CLIENT_ID = "test-client-id";
export const OAUTH2_CLIENT_SECRET = "test-client-secret";
export const OAUTH2_USERNAME = "testuser";
export const OAUTH2_PASSWORD = "testpass";

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
 * Toggles misc/mock-api.js's `features.konnectSync.enabled` flag, which the
 * app reads once at startup to decide whether the Konnect sidebar tab is
 * offered at all. Same pre-launch timing/reset requirements and per-worker
 * scoping as `setGitSyncFeatureFlag()`.
 * @param enabled - Whether the Konnect Sync feature should be enabled
 */
export async function setKonnectSyncFeatureFlag(
  enabled: boolean,
): Promise<void> {
  await fetch(`${MOCK_API_SERVER}/_admin/features/konnect-sync`, {
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

/**
 * Launches the app's `ElectronApplication` against `dataPath`, exactly as
 * the `insomnia` fixture does on a test's first launch — factored out so
 * `AppFlow.restart()` can relaunch mid-test without duplicating the
 * executable/args/env derivation. Deliberately skips
 * `resetCloudSyncState()`/`resetVaultState()`: a restart must preserve
 * whatever state the test already built up.
 * @param options - The same `dataPath`/`skipOnboarding`/`vaultKey`/`vaultSalt` values the original launch used
 * @returns The freshly-launched ElectronApplication
 */
export async function launchInsomniaElectron(options: {
  dataPath: string;
  skipOnboarding: boolean;
  vaultKey: string;
  vaultSalt: string;
}): Promise<ElectronApplication> {
  const { dataPath, skipOnboarding, vaultKey, vaultSalt } = options;

  if (INSOMNIA_DEV_MODE) {
    await ensureInsomniaDevBuild();
  }

  const executablePath =
    process.env.INSOMNIA_BINARY ??
    (INSOMNIA_DEV_MODE
      ? (require(path.join(INSOMNIA_SRC_PACKAGE, "..", "..", "node_modules", "electron")) as string)
      : "/Applications/Insomnia.app/Contents/MacOS/Insomnia");
  const args = INSOMNIA_DEV_MODE
    ? [INSOMNIA_SRC_PACKAGE, "--no-sandbox"]
    : ["--no-sandbox"];

  const { ELECTRON_RUN_AS_NODE: _ignored, ...launchEnv } =
    process.env as Record<string, string>;

  return electron.launch({
    executablePath,
    args,
    env: {
      ...launchEnv,
      ...(INSOMNIA_DEV_MODE ? { NODE_ENV: "development" } : {}),
      INSOMNIA_DATA_PATH: dataPath,
      // Empty string (not "false") so the renderer's `if (skipOnboarding)`
      // guard in entry.client.tsx is falsy and onboarding/login can
      // actually render — "false" is still a non-empty, truthy string
      // there.
      INSOMNIA_SKIP_ONBOARDING: skipOnboarding ? "true" : "",
      INSOMNIA_SESSION,
      INSOMNIA_API_URL: MOCK_API_SERVER,
      INSOMNIA_APP_WEBSITE_URL: `${MOCK_API_SERVER}/website`,
      INSOMNIA_AI_URL: `${MOCK_API_SERVER}/ai`,
      INSOMNIA_UPDATES_URL: MOCK_API_SERVER,
      KONNECT_API_URL: MOCK_API_SERVER,
      PLAYWRIGHT: "true",
      // Seeds `userSession.vaultSalt`/`.vaultKey` directly at startup
      // (see `common/account/session.ts`'s `setVaultSessionData()`),
      // bypassing the real generate/enter-key UI — an empty string is a
      // no-op, same as `INSOMNIA_SKIP_ONBOARDING` above. `PLAYWRIGHT_TEST`
      // is a distinct renderer-only flag from the `PLAYWRIGHT` one above
      // (main process, external-vault-plugin bypass) — it's what makes
      // `decryptVaultKeyFromSession()` return `INSOMNIA_VAULT_KEY`
      // verbatim instead of trying to decrypt it as real Electron
      // `safeStorage` ciphertext, so it's only turned on when a `vaultKey`
      // is actually supplied.
      INSOMNIA_VAULT_KEY: vaultKey,
      INSOMNIA_VAULT_SALT: vaultSalt,
      PLAYWRIGHT_TEST: vaultKey ? "true" : "",
    },
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

// The app sends this as the `x-session-id` header on every request to
// mock-api.js, so it's also the key mock-api.js uses to keep per-instance
// state (feature flags, ...) from leaking between Electron instances that
// are running concurrently in different Playwright workers — see
// setGitSyncFeatureFlag() below. Suffixed with TEST_PARALLEL_INDEX, which
// Playwright guarantees is stable for a worker's lifetime and never shared
// by two concurrently-running workers (unlike TEST_WORKER_INDEX, which
// changes on retry): https://playwright.dev/docs/test-parallel.
export const SESSION_ID = `sess_64a477e6b59d43a5a607f84b4f73e3ce-w${process.env.TEST_PARALLEL_INDEX ?? "0"}`;

const INSOMNIA_SESSION = JSON.stringify({
  id: SESSION_ID,
  sessionExpiry: new Date(2_147_483_647_000),
  email: "insomnia-user@konghq.com",
  accountId: "acct_64a477e6b59d43a5a607f84b4f73e3ce",
  firstName: "Rick",
  lastName: "Morty",
  publicKey: {
    alg: "RSA-OAEP-256",
    e: "AQAB",
    ext: true,
    key_ops: ["encrypt"],
    kty: "RSA",
    // Must stay in sync with misc/mock-api.js's PUBLIC_KEY_N — see that
    // constant's comment for why (was a mismatched keypair before
    // 2026-08-31, causing every real RSA-OAEP unwrap to fail).
    n: "5h0z0z5R_0oxtdzFGAeVAie9T3HdnQ9U1oIo5PjK-nM3HD2heYDVD_RX6uSwxGy6Mt21aNyC6rAq5sQAh1_uIcf1pifeLqOH0TaN0g2iA2JfRqqO37Tzv5AVQQavdeqKOQCpDQiRM_fP1FzQVcgE4YGUGtbVUGt7FO_XvbHhp-ScZLrLC4AplrJeykxAKq7_qMX3hJGbURXtNWu36pyXpFV87QAxMBdpU-ZmnxSFcKrJAv0Y6WcfkFITgn8bmxFTliFhNPvpAk4AP2ltNlp-Vy63BI_ddt35yNnkKhZyboeW_VfMPypw2Ar5TkH314Qkl9psamkkBVmUdAyiE9YvcQ",
  },
  encPrivateKey: {
    iv: "ee5a6e16693b3b61ae2cf07d",
    t: "d0a8c3b2ff15771e56ba890907ea6bc7",
    // Must stay in sync with misc/mock-api.js's ENC_KEY_D.
    d: "0a46ee78889a1478add7efe116d4d30bd7e361a9bb0417605989fd7b96a90fcf81ce46e9ed706f311fb44c351536832ace1da3b62c866f1ed9d2e2be627d1e0a426b338ece60d753b3143bf60802665a2317834482dbb2287f3f1117274d4740b84e8c642b3f5665db46422da0b2ffdd18cf1f19519ebe7ff2dd532f735633439229d3b4238b936b70e2372ba2a989693a752c292d93ed858cc71cb659dfe4801b46d910318b0b938345b6fc22c5c8721ccc951a3a4f45db525e57b499c156d8faed364d9bbd983f047559a130f8cff3c640b750196041db473030fdc4a86557987bfbf58013447ad7395f20f333c493f5fc55481a1b4c987ff34ced6d6c87358948e808449cda3920c410db0cc471ca40e5a6772ded0b37a234dd22dd1a896954fb53e9086ca231ed1e47fd03579543521e169f834ac364fd0045b529c93f0759af8ecdc95973ee5dfb05a10e05158717f85ec714423d54baae0d584a5c22f3d04240b853ee2fb67401c765549b29b8e1b9742247148d16fe23b5bcaa6c8a039a74936626cd0396313ed56a9c32ae631599ffdce90355385aada2d64edd09fcb4c820d6ff671bd9511f275410d89d8c3f94c7e0946767ebcdcb1930d358068574e71b31935e02259f314fcd7f3a8c0c8bbfa81a2ba7480e8a299227d8ac9899ad3098399b61aa3fd0e9e0811f10bd2adab59153f0604b596d240dccfbee526d1ded57641cc741bb9106f73d347b031194b6006f74ca005fc6b8145e53a6eb13c396b1f9bb3e6e357879a36cee68fa1c84fe4ec9c703232952eb775d94fd01c06247af58993ebe5d9c8e42a5c293f51122d434eadadd3c40533a82e26ce3fffcc656020a75596b0b593bc2d59ada41457e7e4cf527e0a16b63132db83e210d2c00e81eff1e69d9914c6fdebd2cf36dc688aa4ca7e46c668bd2b830f17f897802c0b7a749ad54091e33b467d5bcfbb6644bea4f41ddb08abda513c2aac52fa787d9af7cf8543aacc3c6f5b606f56cdd735059ca5de71b08d9e5e45214659e79575f37c7cd64741759af8acbf9eadbd2e2039737ce2081b688029d0b607a4402b7b66121fc0101bcbd2f3caf171a3c486c02c3db1a5ec2ed7392bc9b1190c95177a2a1b69f3f904d1d0a02bb411bc9613d87f47b86fa1a7289b9385820301e0c77e2a724f090f9220276490af49a18a2c7eb8067b1ea2dadbb9d08c18e30cc40ceffa5558801957f90d0513c6b83cc1829c592e5d9c955d24d543669b395e8fafd5c6b7ae661664b8791d6e4746e72c39feb80efb83205f34c83fa854db8c55d3c2db3d7baded8f5968a4ec9eeb2dc8a4d9260c75f44c82688110b6c2983c2b966be19b4d7fd6f20387d7b491004deb4389e376e60fc4123872d34979f86917ff77c63393b8519d02c13453068a4fd01a5ce77c563da1dc73347e29b575b9fbe7fd91b100ebfa8896a1df27923817f353c9484a9c0984626dc48951c99e6ed9771cbcff70c9626249c51443db852e69043ecbd62f4b79d83f6ae183e6987bf1de48bb814fc71002f22bc85d9fc58068af8dc5323c35160e662df6bb9741f5484a7c3713f2fa758c17fe62223f3988562662c25af1256cb446f5be717bbf48b97ffb25e3bc0673b95e67943083194f07b2f192de763367e2e77c524307d57ec8c14954f1a20e18a45f12f8c38b7950742e4a4905b89f7492e899c05c6a512f36366461aa9f86bc338896eee2d0f078116d982c66c8b88be80740f2fb1fe82a1cb8ee2fab9130f2ebb8b0a1ce4d43979b02b40f6391cd25dbe81c32241e9aeb5e2a1f99bbaed4dff490bc46638b76b1540475ef95e7e0351931aa9c4c29682ee762b797289259bb8dc46f5c193408f71b9a91fe85f3a7a9858078a554dd9ef5a42193f30ad24f2df16ca87c517e63aed30bed60383e4426a15ae806064cd978a68560c067d648ac0ed6672e7e74c3452894878eca95ba3102ed9c1b58300492b79bbcde14b86267179082af0a3c2c85e0bd7e49563071c5ac1e5de72add19bd2d8773b4fa983f10e2650b19bc3f25a50e738d084b07a0a60373c6fcfab070fa0a98fc7a87d1c8e3b671e6204d51264ba1baea6e99c0719bcd59749ceebc43309ac42b3e424ec9088973a4b03239426fb9c47e89021ca5515af87929fcf299730247565092ba5a39180d26d11e80439fb2b4f716ee2a33a7fde39a6af06598ce8079163a44d3c444f879f68119186d2b21cf59ea0f3e39341e70c789300bf3597b41370829d23a671dbe3b87a28b0871d31f4a7dd4682218122cf7ca9362253f5a826fcfba46e8613f71647e7097f25fb67e74ef7c5c6a4cf5aece0ad28927c1d96e2a23bc6ab2a20593f253e509e850ee6b40470d5f7ff478c7c1e58a94d54a5812f7e072e37f084ebd23e2d9897ee6dd54945fb87c7eea23e1c401a3eca01e993373ea7154846d96677139720a8457e601b858c61f58e61cbb7658389290423af81cc3bf5dfe69f12b8edd94eb3aa1d93b0f2125546d848b7e76954b3a79d3c38e96f97a2c8298a27c6101fe1b51cd2764e60b83378b035f6",
    ad: "",
  },
  symmetricKey: {
    alg: "A256GCM",
    ext: true,
    k: "w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=",
    key_ops: ["encrypt", "decrypt"],
    kty: "oct",
  },
});

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
    win.setDefaultTimeout(DEFAULT_TIMEOUT);

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

    await use(win);

    // A test that called AppFlow.restart() already closed this `win` —
    // its screencast can't be stopped, so tolerate that on teardown.
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
