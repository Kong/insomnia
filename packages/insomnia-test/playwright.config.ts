import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// By default, misc/fixtures.ts launches the app straight out of the
// sibling ../insomnia source checkout (its local `electron` binary against
// packages/insomnia) instead of a packaged build — so the app under test
// always reflects whatever's currently checked out there, not whichever
// build happened to get installed last. That app's renderer loads from
// this Vite dev server, so it has to be up before any test's Electron
// instance launches.
//
// Opts out automatically whenever INSOMNIA_BINARY is set (CI always sets
// it, pointing at that run's freshly built/cached binary — see
// .github/workflows/playwright.yml), or explicitly via
// INSOMNIA_DEV_MODE=false/0 to fall back to the packaged
// /Applications/Insomnia.app build locally without pointing at a specific
// binary.
const isDevMode =
  !process.env.INSOMNIA_BINARY &&
  process.env.INSOMNIA_DEV_MODE !== "false" &&
  process.env.INSOMNIA_DEV_MODE !== "0";
const INSOMNIA_SRC_PACKAGE = path.resolve(__dirname, "..", "insomnia");

export default defineConfig({
  timeout: 90 * 1000,
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list", { printSteps: true }],
    ["html", { open: "never" }],
  ],
  outputDir: "./test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 60 * 1000,
  },

  webServer: [
    {
      command: "node misc/mock-api.js",
      url: "http://localhost:4010/v3/users/me",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/event-stream-server.js",
      url: "http://localhost:4050/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/echo-server.js",
      url: "http://localhost:4060/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/socket-server.js",
      url: "http://localhost:3000/socket.io/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/ws-echo-server.js",
      url: "http://localhost:4040",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/mcp-server.js",
      url: "http://localhost:4020/",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/grpc-server.js",
      port: 9000,
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/git-server.js",
      url: "http://localhost:4070/health",
      reuseExistingServer: !process.env.CI,
      timeout: 10 * 1000,
    },
    {
      command: "node misc/oauth2-server.js",
      url: "http://localhost:4080/health",
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
