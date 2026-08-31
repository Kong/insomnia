import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { PlaywrightTestConfig } from '@playwright/test';
const isWindows = os.platform() === 'win32';

// Reused across runs within this worktree only: .vite-port is written per-worktree by vite.config.ts,
// so reading it here lets playwright reuse an already-running dev server instead of always starting a new one.
let existingVitePort: string | undefined;
try {
  existingVitePort = fs.readFileSync(path.join(__dirname, '../insomnia/.vite-port'), 'utf8').trim();
} catch {}
const echoServer: PlaywrightTestConfig['webServer'] = {
  name: 'Echo server',
  command: 'npm run serve',
  url: 'http://localhost:4010',
  timeout: 20 * 1000,
  reuseExistingServer: !process.env.CI,
  stdout: 'ignore',
  stderr: 'pipe',
  wait: {
    stdout: /Listening at http/,
  },
};
const viteServer: PlaywrightTestConfig['webServer'] = {
  name: 'Vite Server',
  cwd: '../../',
  command: 'npm run watch:app',
  ...(existingVitePort ? { url: `http://localhost:${existingVitePort}` } : {}),
  timeout: 120 * 1000,
  reuseExistingServer: !process.env.CI,
  stdout: 'pipe',
  stderr: 'pipe',
  wait: {
    stdout: /VITE\s+ready in/,
  },
};
const onlyStartWebServerInDev = !process.env.BUNDLE || process.env.BUNDLE === 'dev';
const config: PlaywrightTestConfig = {
  projects: [
    {
      // High-confidence smoke/sanity checks, runs on Test App only on Ubuntu
      name: 'Smoke',
      testMatch: /smoke\/.*.test.ts/,
      retries: 1,
    },
    {
      // Single critical path test, runs on release recurring
      name: 'Critical',
      testMatch: /critical\/.*.test.ts/,
      retries: 0,
    },
    {
      // Single critical path test, runs on release recurring
      name: 'Migration',
      testMatch: /migration\/.*.test.ts/,
      retries: 0,
    },
  ],
  webServer: [echoServer, ...(onlyStartWebServerInDev ? [viteServer] : [])],
  use: {
    trace: {
      mode: 'retain-on-failure',
      screenshots: true,
      snapshots: true,
      sources: true,
    },
  },
  reporter: process.env.CI
    ? [['github'], ['line'], ['junit', { outputFile: 'test-results.xml', includeRetries: true }]]
    : [['dot']],
  timeout: process.env.CI || isWindows ? 60 * 1000 : 20 * 1000,
  forbidOnly: !!process.env.CI,
  outputDir: 'traces',
  testDir: 'tests',
  expect: {
    timeout: process.env.CI ? 25 * 1000 : 10 * 1000,
  },
  workers: 1,
  globalTimeout: 20 * 60 * 1000,
};
export default config;
