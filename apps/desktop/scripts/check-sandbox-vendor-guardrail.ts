/**
 * Guardrail (sandbox plan M3): the sandbox's vetted, isolated pin for a vendored lib must never
 * exceed the version the app itself actually resolves for that same lib — the sandbox may lag the
 * app, but it must never lead it. Run standalone in CI (`npm run sandbox:vendored:guardrail -w
 * insomnia`) and imported by `generate-sandbox-vendored.ts` so a plain local regen also catches a
 * hand-edited `vendored/pkg/package.json` that oversteps.
 *
 * "App's resolved version" is read from the app's own ambient `node_modules` (i.e. after the root
 * `npm ci`) — the same install the app actually runs with — not re-derived from a semver range.
 */
import fs from 'node:fs';
import path from 'node:path';

import semver from 'semver';

import { INSOMNIA_ROOT, PKG_DIR } from './sandbox-vendored-lib';
import { VENDORED_LIBS } from './sandbox-vendored-libs-list';

const pinnedVersion = (lib: string): string => {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  const pin = pkgJson.dependencies[lib];
  if (!pin) {
    throw new Error(`'${lib}' has no pin in ${path.relative(INSOMNIA_ROOT, PKG_DIR)}/package.json`);
  }
  if (!semver.valid(pin)) {
    throw new Error(`'${lib}' in ${path.relative(INSOMNIA_ROOT, PKG_DIR)}/package.json must be an exact version (no ^ or ~), got '${pin}'`);
  }
  return pin;
};

const appResolvedVersion = (lib: string): string => {
  // Resolved via Node's normal module resolution scoped to INSOMNIA_ROOT — npm workspaces may hoist
  // this to the repo-root node_modules rather than apps/desktop/node_modules, so a bare
  // path.join would miss it; require.resolve walks up the same way `require(lib)` would from here.
  let resolvedPkgJsonPath: string;
  try {
    resolvedPkgJsonPath = require.resolve(`${lib}/package.json`, { paths: [INSOMNIA_ROOT] });
  } catch {
    throw new Error(`App's own install has no '${lib}' resolvable from ${path.relative(path.dirname(INSOMNIA_ROOT), INSOMNIA_ROOT)} — run 'npm ci' at the repo root first.`);
  }
  const pkg = JSON.parse(fs.readFileSync(resolvedPkgJsonPath, 'utf8')) as { version: string };
  return pkg.version;
};

/** Throws with a descriptive message if any vetted lib's sandbox pin exceeds the app's resolved version. */
export const checkVendorGuardrail = (libs: string[]): void => {
  const violations: string[] = [];
  for (const lib of libs) {
    const sandboxPin = pinnedVersion(lib);
    const appVersion = appResolvedVersion(lib);
    if (semver.gt(sandboxPin, appVersion)) {
      violations.push(`'${lib}': sandbox pin ${sandboxPin} > app's resolved version ${appVersion} — the sandbox must never be ahead of the app.`);
    }
  }
  if (violations.length) {
    throw new Error(`Sandbox-vendored guardrail violated:\n  ${violations.join('\n  ')}`);
  }
};

// Guarded so importing `checkVendorGuardrail` elsewhere (generate-sandbox-vendored.ts,
// upgrade-sandbox-vendored.ts) doesn't also print/exit as a side effect — only this file's own
// direct invocation (`npm run sandbox:vendored:guardrail`) should behave as a CLI.
if (require.main === module) {
  try {
    checkVendorGuardrail(VENDORED_LIBS.map(l => l.name));
    console.log('[vendored] guardrail OK — no sandbox pin exceeds the app\'s resolved version.');
  } catch (err) {
    console.error(`::error::${(err as Error).message}`);
    process.exit(1);
  }
}
