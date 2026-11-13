import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const INSO_PACKAGE = path.resolve(import.meta.dirname, "..", "..", "insomnia-inso");
const INSO_BIN = path.join(INSO_PACKAGE, "bin", "inso");
const INSO_BUNDLE = path.join(INSO_PACKAGE, "dist", "index.js");

export interface InsoResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs the locally built `inso` CLI (`packages/insomnia-inso`, build it first
 * with `npm run build -w insomnia-inso`) and resolves with its output and exit
 * code. A non-zero exit code is a normal result, not a rejection.
 *
 * `inso` is executed through the repo's Electron binary with
 * `ELECTRON_RUN_AS_NODE`, so it loads the same Electron-targeted
 * `@getinsomnia/node-libcurl` the app does and the shared `node_modules`
 * never has to be switched to a Node-targeted build.
 */
export function runInso(args: string[], cwd?: string): Promise<InsoResult> {
  if (!existsSync(INSO_BUNDLE)) {
    return Promise.reject(
      new Error(`inso bundle not found at ${INSO_BUNDLE}; run "npm run build -w insomnia-inso" first`),
    );
  }

  const electronPath = require(path.resolve(INSO_PACKAGE, "..", "..", "node_modules", "electron")) as string;

  return new Promise((resolve, reject) => {
    execFile(
      electronPath,
      [INSO_BIN, ...args],
      { cwd, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NO_COLOR: "1" } },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          reject(error);
          return;
        }
        resolve({ stdout, stderr, exitCode: typeof error?.code === "number" ? error.code : 0 });
      },
    );
  });
}
