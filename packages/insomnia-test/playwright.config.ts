import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { ensureCerts } from "./misc/certs";
import { USE_LOCAL_SOURCE } from "./misc/constants";

// Which app the tests launch is picked by USE_LOCAL_SOURCE in misc/constants.ts
// (INSOMNIA_BINARY, which CI always sets, overrides it). When it launches the
// sibling ../insomnia source checkout, that app's renderer loads from the Vite
// dev server below, so it has to be up before any test's Electron instance
// launches.
const isDevMode = !process.env.INSOMNIA_BINARY && USE_LOCAL_SOURCE;
const INSOMNIA_SRC_PACKAGE = path.resolve(__dirname, "..", "insomnia");

// The mock servers' TLS/mTLS key pairs are generated rather than committed.
// Do it here, once, before any webServer below starts reading them.
ensureCerts();

export default defineConfig({
  timeout: 90 * 1000,
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Only wired up when COVERAGE=true (see misc/coverage.ts) — cleans/merges
  // the shared V8 coverage cache once per run rather than per test.
  globalSetup: "./misc/coverage-global-setup.ts",
  globalTeardown: "./misc/coverage-global-teardown.ts",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  outputDir: "./test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30 * 1000,
  },

  webServer: [
    {
      command: "npx esr misc/mock-api.ts",
      url: "http://localhost:4010/v3/users/me",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/event-stream-server.ts",
      url: "http://localhost:4050/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/echo-server.ts",
      url: "http://localhost:4060/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/socket-server.ts",
      url: "http://localhost:3000/socket.io/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/ws-echo-server.ts",
      url: "http://localhost:4040",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/mcp-server.ts",
      url: "http://localhost:4020/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/grpc-server.ts",
      port: 9000,
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/git-server.ts",
      url: "http://localhost:4070/health",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      command: "npx esr misc/oauth2-server.ts",
      url: "http://localhost:4080/health",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "npx esr misc/mock-bin-server.ts",
      url: "http://localhost:4090/health",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    ...(isDevMode
      ? [
          {
            command: "npm run start:dev-server",
            cwd: INSOMNIA_SRC_PACKAGE,
            url: "http://localhost:3334",
            // Always reuse — INSOMNIA_DEV_MODE is a local workflow, and
            // restarting Vite's cold start on every run wastes minutes.
            reuseExistingServer: true,
            timeout: 60 * 1000,
          },
        ]
      : []),
  ],

  projects: [
    {
      name: "insomnia",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
