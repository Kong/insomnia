import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exit } from 'node:process';

import { v4 as uuidv4 } from 'uuid';

// Default to dev so that the playwright vscode extension works
export const bundleType = () => process.env.BUNDLE || 'dev';

export const getFixturePath = (fixturePath: string) => path.join(__dirname, '..', 'fixtures', fixturePath);

export const loadFixture = async (fixturePath: string) => {
  const buffer = await fs.promises.readFile(path.join(__dirname, '..', 'fixtures', fixturePath));
  return buffer.toString('utf8');
};

export const copyFixtureDatabase = async (fixturePath: string, dataPath: string) => {
  const fixtureDir = path.join(__dirname, '..', 'fixtures', fixturePath);

  if (!fs.existsSync(fixtureDir)) {
    throw new Error(`Cannot find fixture directory ${fixtureDir}`);
  }

  await fs.promises.cp(fixtureDir, dataPath, { recursive: true });
};

/**
 * Pre-seeds a minimal Settings document into `dataPath` before Insomnia launches,
 * so a test starts with specific settings instead of the app's defaults. Fields
 * left out of `patch` aren't left blank — the app backfills any doc it loads with
 * `models.settings.init()`'s defaults for fields the doc doesn't have — so this
 * only needs to carry the overrides a test actually cares about.
 */
export const seedSettings = async (dataPath: string, patch: Record<string, unknown>) => {
  await fs.promises.mkdir(dataPath, { recursive: true });
  const doc = {
    _id: `set_${uuidv4().replace(/-/g, '')}`,
    type: 'Settings',
    parentId: null,
    modified: Date.now(),
    created: Date.now(),
    ...patch,
  };
  await fs.promises.writeFile(path.join(dataPath, 'insomnia.Settings.db'), `${JSON.stringify(doc)}\n`);
};

export const randomDataPath = () => path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuidv4()}`);
export const INSOMNIA_DATA_PATH = randomDataPath();

// Packaged app paths
const pathLookup: Record<string, string | Record<string, string>> = {
  win32: path.join('win-unpacked', 'Insomnia.exe'),
  darwin: path.join('mac-universal', 'Insomnia.app', 'Contents', 'MacOS', 'Insomnia'),
  linux: {
    x64: path.join('linux-unpacked', 'insomnia'),
    arm64: path.join('linux-arm64-unpacked', 'insomnia'),
  },
};

let binaryPath: string;
const platformPath = pathLookup[process.platform];
if (typeof platformPath === 'string') {
  binaryPath = platformPath;
} else if (process.arch in platformPath) {
  binaryPath = platformPath[process.arch];
} else {
  throw new Error(`Cannot find binary path for ${process.platform} ${process.arch}`);
}

export const cwd = path.resolve(__dirname, '..', '..', 'insomnia');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const insomniaBinary = path.join(cwd, 'dist', binaryPath);
const electronBinary = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron',
);

export const executablePath = bundleType() === 'package' ? insomniaBinary : electronBinary;

// NOTE: entry.main.min.js is built by app-build in /build and also by the watcher in /src
export const mainPath = path.join(bundleType() === 'dev' ? 'src' : 'build', 'entry.main.min.js');

const hasMainBeenBuilt = fs.existsSync(path.resolve(cwd, mainPath));
const hasBinaryBeenBuilt = fs.existsSync(path.resolve(cwd, insomniaBinary));

// NOTE: guard against missing build artifacts
if (bundleType() === 'dev' && !hasMainBeenBuilt) {
  console.error(`ERROR: ${mainPath} not found at ${path.resolve(cwd, mainPath)}
  Ensure that playwright has run npm run watch:app`);
  exit(1);
}
if (bundleType() === 'build' && !hasMainBeenBuilt) {
  console.error(`ERROR: ${mainPath} not found at ${path.resolve(cwd, mainPath)}
  Have you run "npm run app-build"?`);
  exit(1);
}
if (bundleType() === 'package' && !hasBinaryBeenBuilt) {
  console.error(`ERROR: ${insomniaBinary} not found at ${path.resolve(cwd, insomniaBinary)}
  Have you run "npm run app-package"?`);
  exit(1);
}
if (process.env.DEBUG) {
  console.log(`Using current working directory at ${cwd}`);
  console.log(`Using executablePath at ${executablePath}`);
  console.log(`Using mainPath at ${mainPath}`);
}
