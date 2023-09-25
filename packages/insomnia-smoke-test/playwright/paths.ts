import fs from 'fs';
import os from 'os';
import path from 'path';
import { exit } from 'process';
import { v4 as uuidv4 } from 'uuid';

// Default to dev so that the playwright vscode extension works
export const bundleType = () => process.env.BUNDLE || 'dev';

export const loadFixture = async (fixturePath: string) => {
  const buffer = await fs.promises.readFile(path.join(__dirname, '..', 'fixtures', fixturePath));
  return buffer.toString('utf-8');
};

export const copyFixtureDatabase = async (fixturePath: string, dataPath: string) => {
  const fixtureDir = path.join(__dirname, '..', 'fixtures', fixturePath);

  if (!fs.existsSync(fixtureDir)) {
    throw new Error(`Cannot find fixture directory ${fixtureDir}`);
  }

  await fs.promises.cp(fixtureDir, dataPath, { recursive: true });
};

export const randomDataPath = () => path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuidv4()}`);
export const INSOMNIA_DATA_PATH = randomDataPath();

// Packaged app paths
const pathLookup: Record<string, string> = {
  win32: path.join('win-unpacked', 'Insomnia.exe'),
  darwin: path.join('mac-universal', 'Insomnia.app', 'Contents', 'MacOS', 'Insomnia'),
  linux: path.join('linux-unpacked', 'insomnia'),
};
export const cwd = path.resolve(__dirname, '..', '..', 'insomnia');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const insomniaBinary = path.join(cwd, 'dist', pathLookup[process.platform]);
const electronBinary = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

export const executablePath = bundleType() === 'package' ? insomniaBinary : electronBinary;

// NOTE: main.min.js is built by app-build in /build and also by the watcher in /src
export const mainPath = path.join(bundleType() === 'dev' ? 'src' : 'build', 'main.min.js');

const hasMainBeenBuilt = fs.existsSync(path.resolve(cwd, mainPath));
const hasBinaryBeenBuilt = fs.existsSync(path.resolve(cwd, insomniaBinary));

// NOTE: guard against missing build artifacts
if (bundleType() === 'dev' && !hasMainBeenBuilt) {
  console.error(`ERROR: ${mainPath} not found at ${path.resolve(cwd, mainPath)}
  Have you run "npm run watch:app"?`);
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
