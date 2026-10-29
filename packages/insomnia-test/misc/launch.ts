import { spawn } from "node:child_process";
import path from "node:path";

import type { ElectronApplication } from "@playwright/test";
import { _electron as electron } from "@playwright/test";

import { MOCK_API_SERVER } from "./constants";
import { coverageLaunchEnv } from "./coverage";

/**
 * By default, the `insomnia` fixture below launches the app straight out of
 * the sibling `../insomnia` source checkout (its local `electron` binary
 * against `packages/insomnia`, renderer served by the Vite dev server
 * `playwright.config.ts` starts under this same condition) instead of a
 * packaged build — so the app under test always reflects whatever's
 * currently checked out there, not whichever build happened to get
 * installed last. Opts out automatically whenever `INSOMNIA_BINARY` is set
 * (CI always sets it — see `.github/workflows/insomnia-test.yml`), or
 * explicitly via `INSOMNIA_DEV_MODE=false`/`0` to fall back to the packaged
 * `/Applications/Insomnia.app` build locally without pointing at a specific
 * binary.
 */
const INSOMNIA_DEV_MODE =
  !process.env.INSOMNIA_BINARY &&
  process.env.INSOMNIA_DEV_MODE !== "false" &&
  process.env.INSOMNIA_DEV_MODE !== "0";
const INSOMNIA_SRC_PACKAGE = path.resolve(__dirname, "..", "..", "insomnia");

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
        process.execPath,
        [require.resolve("esbuild-runner/bin/esr.js"), "esbuild.entrypoints.ts"],
        {
          cwd: INSOMNIA_SRC_PACKAGE,
          stdio: "inherit",
          env: { ...process.env, NODE_ENV: "development" },
        },
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
      ...coverageLaunchEnv(),
      ...(INSOMNIA_DEV_MODE ? { NODE_ENV: "development" } : {}),
      INSOMNIA_DATA_PATH: dataPath,
      // Empty string (not "false") so the renderer's `if (skipOnboarding)`
      // guard in entry.client.tsx is falsy and onboarding/login can
      // actually render — "false" is still a non-empty, truthy string
      // there.
      INSOMNIA_SKIP_ONBOARDING: skipOnboarding ? "true" : "",
      INSOMNIA_SESSION: await buildInsomniaSession(),
      INSOMNIA_API_URL: MOCK_API_SERVER,
      INSOMNIA_APP_WEBSITE_URL: `${MOCK_API_SERVER}/website`,
      INSOMNIA_AI_URL: `${MOCK_API_SERVER}/ai`,
      INSOMNIA_UPDATES_URL: MOCK_API_SERVER,
      KONNECT_API_URL: MOCK_API_SERVER,
      // The mock serves a single regional endpoint; without this the app
      // fans out to all five default regions against the same URL.
      KONNECT_API_REGIONS: "us",
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


// The app sends this as the `x-session-id` header on every request to
// mock-api.js, so it's also the key mock-api.js uses to keep per-instance
// state (feature flags, ...) from leaking between Electron instances that
// are running concurrently in different Playwright workers — see
// setGitSyncFeatureFlag() below. Suffixed with TEST_PARALLEL_INDEX, which
// Playwright guarantees is stable for a worker's lifetime and never shared
// by two concurrently-running workers (unlike TEST_WORKER_INDEX, which
// changes on retry): https://playwright.dev/docs/test-parallel.
export const SESSION_ID = `sess_64a477e6b59d43a5a607f84b4f73e3ce-w${process.env.TEST_PARALLEL_INDEX ?? "0"}`;

// The account keys come from mock-api.js, which generates them at startup so
// no key material lives in the repo (see GET /_admin/session-keys there).
// Fetched per launch rather than cached: a reused mock-api process or a
// restarted one always hands back keys that match its own responses.
async function buildInsomniaSession(): Promise<string> {
  const res = await fetch(`${MOCK_API_SERVER}/_admin/session-keys`);
  if (!res.ok) {
    throw new Error(`Fetching mock-api session keys failed (${res.status})`);
  }
  const { publicKey, encPrivateKey, symmetricKey } = await res.json();
  return JSON.stringify({
    id: SESSION_ID,
    sessionExpiry: new Date(2_147_483_647_000),
    email: "insomnia-user@konghq.com",
    accountId: "acct_64a477e6b59d43a5a607f84b4f73e3ce",
    firstName: "Rick",
    lastName: "Morty",
    publicKey,
    encPrivateKey,
    symmetricKey,
  });
}
