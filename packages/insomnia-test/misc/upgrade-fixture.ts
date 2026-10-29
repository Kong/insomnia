import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { TestInfo } from '@playwright/test';

import { UpgradePhase } from '../enums/upgrade-phase';

const TEST_PACKAGE = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(TEST_PACKAGE, '..', '..');
const TREES_DIR = process.env.INSOMNIA_VERSIONS_DIR ?? path.join(os.tmpdir(), 'insomnia-test-versions');
const PHASE_DEV_SERVER_PORT = process.env.INSOMNIA_UPGRADE_DEV_PORT ?? '3434';
const READY_MARKER = '.insomnia-test-ready';
const COPY_EXCLUDES = new Set(['node_modules', 'test-results', 'playwright-report', 'blob-report', 'coverage']);
const LOG_TAIL_LINES = 60;
const FIRST_PHASE_TIMEOUT = 20 * 60 * 1000;

const UPGRADE_DATA_PATH_ENV = 'INSOMNIA_UPGRADE_DATA_PATH';

/**
 * Marks a test as belonging to one phase of an upgrade case: the fixtures skip it in the other phase.
 * Pass the result as the test's details: `test('...', upgradePhase(UpgradePhase.Before), async () => {})`.
 * @param phase - The phase the test runs in
 * @returns Playwright test details carrying the phase as a tag
 */
export function upgradePhase(phase: UpgradePhase): { tag: string } {
  return { tag: phase };
}

export interface UpgradeFixtures {
  /** The old Insomnia to create data with: a git tag or commit, e.g. `core@13.3.0`. Set with `test.use()`. */
  appVersion: string | undefined;
  /** Optional framework commit/branch whose Page/Flow code the first phase uses; defaults to the working copy. */
  frameworkRef: string | undefined;
}

function revParse(ref: string): string {
  return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
}

// CI checks out a shallow clone without tags, so a missing tag is fetched on demand.
function resolveRef(ref: string): string {
  try {
    return revParse(ref);
  } catch {
    try {
      execFileSync('git', ['fetch', '--depth=1', 'origin', 'tag', ref], { cwd: REPO_ROOT, stdio: 'inherit' });
      return revParse(ref);
    } catch {
      throw new Error(`"${ref}" is not in the local clone and could not be fetched from origin as a tag`);
    }
  }
}

function extract(sha: string, treeDir: string, pathspec: string[] = []): void {
  const archive = execFileSync('git', ['archive', sha, ...pathspec], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 1024,
  });
  execFileSync('tar', ['-x', '-C', treeDir], { input: archive });
}

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function installApp(treeDir: string, appSha: string): void {
  fs.rmSync(treeDir, { recursive: true, force: true });
  fs.mkdirSync(treeDir, { recursive: true });
  extract(appSha, treeDir);

  // Old trees verify the bundled plugins in postinstall, which fails when the private plugin packages are unavailable.
  const rootPackageFile = path.join(treeDir, 'package.json');
  fs.writeFileSync(
    rootPackageFile,
    fs.readFileSync(rootPackageFile, 'utf8').replace(' && npm run verify-bundle-plugins -w insomnia', ''),
  );

  run('npm', ['ci'], treeDir);
  run(process.execPath, [path.join(treeDir, 'node_modules', 'electron', 'install.js')], treeDir);

  // The framework is CommonJS and `require`s insomnia-data, which older trees only export for `import`.
  const dataPackageFile = path.join(treeDir, 'packages', 'insomnia-data', 'package.json');
  const dataPackage = JSON.parse(fs.readFileSync(dataPackageFile, 'utf8'));
  for (const entry of Object.values<Record<string, string>>(dataPackage.exports ?? {})) {
    entry.require ??= entry.import;
  }
  fs.writeFileSync(dataPackageFile, `${JSON.stringify(dataPackage, null, 2)}\n`);

  fs.writeFileSync(path.join(treeDir, READY_MARKER), appSha);
}

function installFramework(treeDir: string, testsSha?: string): void {
  const frameworkDir = path.join(treeDir, 'packages', 'insomnia-test');
  fs.rmSync(frameworkDir, { recursive: true, force: true });

  if (testsSha) {
    extract(testsSha, treeDir, ['packages/insomnia-test']);
  } else {
    fs.cpSync(TEST_PACKAGE, frameworkDir, {
      recursive: true,
      filter: source => !COPY_EXCLUDES.has(path.basename(source)),
    });
  }

  // The old app's lockfile doesn't know the framework's own dependencies.
  const { devDependencies = {} } = JSON.parse(fs.readFileSync(path.join(frameworkDir, 'package.json'), 'utf8'));
  const missing = Object.entries<string>(devDependencies)
    .filter(([name]) => !fs.existsSync(path.join(treeDir, 'node_modules', name)))
    .map(([name, range]) => `${name}@${range}`);
  if (missing.length) {
    run('npm', ['install', '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', ...missing], treeDir);
  }
}

function copySpecFromWorkingCopy(treeDir: string, specFile: string): void {
  for (const relative of [specFile, 'misc/upgrade-fixture.ts', 'enums/upgrade-phase.ts']) {
    const target = path.join(treeDir, 'packages', 'insomnia-test', relative);
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(TEST_PACKAGE, relative), target, { recursive: true });
  }
}

function moveDevServerPort(treeDir: string): void {
  const files = [
    'packages/insomnia/package.json',
    'packages/insomnia/src/main/window-utils.ts',
    'packages/insomnia-test/playwright.config.ts',
  ];
  for (const file of files) {
    const filePath = path.join(treeDir, file);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, fs.readFileSync(filePath, 'utf8').replaceAll('3334', PHASE_DEV_SERVER_PORT));
    }
  }
}

/**
 * Prepares the directory one phase runs in: the whole repo at `app` (so
 * `packages/insomnia` is that Insomnia), with `packages/insomnia-test` swapped
 * for the `tests` ref's copy — or for the working copy when omitted — and the
 * spec file copied in from the working copy. The expensive part
 * (export + `npm ci`) is cached per app commit under `INSOMNIA_VERSIONS_DIR`.
 *
 * The app's Vite dev server is moved off port 3334, which the main Playwright
 * run's own Vite already owns; the tree's config would otherwise reuse that
 * server and show the old app the current UI. The renderer's localStorage is
 * per port, so UI-only state such as which projects are expanded does not
 * carry over to the second phase.
 */
function prepareTree(app: string, tests: string | undefined, specFile: string) {
  const appSha = resolveRef(app);
  const testsSha = tests ? resolveRef(tests) : undefined;

  const treeDir = path.join(TREES_DIR, `${app.replace(/[^\w.-]/g, '_')}-${appSha.slice(0, 8)}`);
  if (!fs.existsSync(path.join(treeDir, READY_MARKER))) {
    installApp(treeDir, appSha);
  }
  installFramework(treeDir, testsSha);
  copySpecFromWorkingCopy(treeDir, specFile);
  moveDevServerPort(treeDir);

  const { version } = JSON.parse(fs.readFileSync(path.join(treeDir, 'packages', 'insomnia', 'package.json'), 'utf8'));
  return { packageDir: path.join(treeDir, 'packages', 'insomnia-test'), version: version as string };
}

function runPlaywright(packageDir: string, spec: string, env: NodeJS.ProcessEnv) {
  const cli = require.resolve('@playwright/test/cli', { paths: [packageDir] });
  return new Promise<{ status: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', spec, '--reporter=line'], { cwd: packageDir, env });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, output }));
  });
}

function appVersionAt(sha: string): string {
  const packageJson = execFileSync('git', ['show', `${sha}:packages/insomnia/package.json`], { cwd: REPO_ROOT });
  return JSON.parse(packageJson.toString()).version;
}

async function runFirstPhase(
  { appVersion, frameworkRef }: Pick<UpgradeFixtures, 'appVersion' | 'frameworkRef'>,
  workDir: string,
  testInfo: TestInfo,
): Promise<void> {
  if (!appVersion) {
    throw new Error("Set the old Insomnia with `test.use({ appVersion: 'core@x.y.z' })`");
  }
  const currentVersion = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages', 'insomnia', 'package.json'), 'utf8'),
  ).version;
  if (appVersionAt(resolveRef(appVersion)) === currentVersion) {
    throw new Error(
      `"${appVersion}" and the current checkout are both Insomnia ${currentVersion} — nothing would be upgraded; use an older appVersion`,
    );
  }

  const specFile = path.relative(TEST_PACKAGE, testInfo.file).split(path.sep).join('/');
  const tree = prepareTree(appVersion, frameworkRef, specFile);
  await testInfo.attach('first-phase-app', {
    body: `Insomnia ${tree.version} (${appVersion})`,
    contentType: 'text/plain',
  });

  // CI would make the child refuse the mock servers this process already started, and CI's INSOMNIA_BINARY
  // would launch the current build instead of the old source; PW_*/TEST_* belong to this worker.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== 'CI' && key !== 'INSOMNIA_BINARY' && !/^(PW_|PWTEST_|TEST_)/.test(key),
    ),
  );
  const { status, output } = await runPlaywright(tree.packageDir, specFile, {
    ...env,
    [UPGRADE_DATA_PATH_ENV]: path.join(workDir, 'data'),
  });

  await testInfo.attach('first-phase-log', { body: output, contentType: 'text/plain' });
  if (status !== 0) {
    const tail = output.split('\n').slice(-LOG_TAIL_LINES).join('\n');
    throw new Error(
      `The first phase (Insomnia ${tree.version}) failed with exit code ${status}; data kept in ${workDir}\n${tail}`,
    );
  }
}

const stringOption: [string | undefined, { option: true }] = [undefined, { option: true }];

const dataPathFixture: [
  (args: UpgradeFixtures, use: (dataPath: string) => Promise<void>, testInfo: TestInfo) => Promise<void>,
  { scope: 'test'; timeout: number },
] = [
  async ({ appVersion, frameworkRef }, use, testInfo) => {
    const childDataPath = process.env[UPGRADE_DATA_PATH_ENV];
    const isBeforeUpgrade = testInfo.tags.includes(UpgradePhase.Before);
    if (!isBeforeUpgrade && !testInfo.tags.includes(UpgradePhase.After)) {
      throw new Error(`Mark the test with upgradePhase(UpgradePhase.Before) or upgradePhase(UpgradePhase.After)`);
    }
    testInfo.skip(
      isBeforeUpgrade !== !!childDataPath,
      isBeforeUpgrade ? 'runs against the old app' : 'runs on the current app',
    );

    if (childDataPath) {
      await use(childDataPath);
      return;
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-upgrade-'));
    await runFirstPhase({ appVersion, frameworkRef }, workDir, testInfo);
    await use(path.join(workDir, 'data'));
    if (testInfo.status === testInfo.expectedStatus) {
      fs.rmSync(workDir, { recursive: true, force: true });
    } else {
      console.log(`[upgrade] data kept in ${workDir}`);
    }
  },
  { scope: 'test', timeout: FIRST_PHASE_TIMEOUT },
];

/**
 * Turns one spec into a two-phase upgrade case: `test.extend<UpgradeFixtures>(upgradeFixtures)`
 * plus `test.use({ appVersion })`. Mark each test with `upgradePhase(UpgradePhase.Before)` or
 * `upgradePhase(UpgradePhase.After)`; the other phase's tests are skipped. Setting up
 * `dataPath` first runs this same spec in a separate Playwright process against
 * the old app (see `prepareTree`), where the `UpgradePhase.Before` tests create the
 * data. The `UpgradePhase.After` tests then run on the current checkout, on the data
 * directory that run wrote, so opening it upgrades that data. The scratch
 * directory is deleted after a passing test and kept otherwise.
 */
export const upgradeFixtures = {
  appVersion: stringOption,
  frameworkRef: stringOption,
  dataPath: dataPathFixture,
};
