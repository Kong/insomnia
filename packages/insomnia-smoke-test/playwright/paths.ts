import fs from 'fs';
import got from 'got';
import os from 'os';
import path from 'path';
import { exit } from 'process';
import * as uuid from 'uuid';

// Default to dev so that the playwright vscode extension works
export const bundleType = () => process.env.BUNDLE || 'dev';

export const loadFixture = async (fixturePath: string) => {
  const buffer = await fs.promises.readFile(path.join(__dirname, '..', 'fixtures', fixturePath));
  return buffer.toString('utf-8');
};

export const randomDataPath = () => path.join(os.tmpdir(), 'insomnia-smoke-test', `${uuid.v4()}`);
export const INSOMNIA_DATA_PATH = randomDataPath();

const pathLookup = {
  win32: path.join('win-unpacked', 'Insomnia.exe'),
  darwin: path.join('mac', 'Insomnia.app', 'Contents', 'MacOS', 'Insomnia'),
  linux: path.join('linux-unpacked', 'insomnia'),
};
const insomniaBinary = path.join('dist', pathLookup[process.platform]);
const electronBinary = path.join('node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

export const executablePath = bundleType() === 'package' ? insomniaBinary : electronBinary;

// NOTE: main.min.js is built by app-build:smoke in /build and also by the watcher in /app
export const mainPath = path.join(bundleType() === 'dev' ? 'app' : 'build', 'main.min.js');
export const cwd = path.resolve(__dirname, '..', '..', 'insomnia-app');

const hasMainBeenBuilt = fs.existsSync(path.resolve(cwd, mainPath));
const hasBinaryBeenBuilt = fs.existsSync(path.resolve(cwd, insomniaBinary));

// NOTE: guard against missing build artifacts
if (bundleType() === 'dev') {
  got('http://localhost:3334').catch(err => {
    console.error(`ERROR: ${err.code} app is not running at http://localhost:3334
    Have you run "npm run watch:app"?`);
    exit(1);
  });
  if (!hasMainBeenBuilt){
    console.error(`ERROR: ${mainPath} not found at ${path.resolve(cwd, mainPath)}
Have you run "npm run watch:app"?`);
    exit(1);
  }
}
if (bundleType() === 'build' && !hasMainBeenBuilt) {
  console.error(`ERROR: ${mainPath} not found at ${path.resolve(cwd, mainPath)}
  Have you run "npm run app-build:smoke"?`);
  exit(1);
}
if (bundleType() === 'package' && !hasBinaryBeenBuilt) {
  console.error(`ERROR: ${insomniaBinary} not found at ${path.resolve(cwd, insomniaBinary)}
  Have you run "npm run app-package:smoke"?`);
  exit(1);
}
if (process.env.DEBUG) {
  console.log(`Using current working directory at ${cwd}`);
  console.log(`Using executablePath at ${executablePath}`);
  console.log(`Using mainPath at ${mainPath}`);
}
