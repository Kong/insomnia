/**
 * Generates the vendored sandbox-module factory sources (sandbox plan M3).
 *
 * Each "vetted" npm library is bundled once, here, into a single CJS string and written to
 * `src/templating/sandbox/vendored/<name>.generated.ts` as a factory-source string the QuickJS
 * module registry can register. The generated files are checked in (reviewable, deterministic) and
 * regenerated with `npm run sandbox:vendored:generate -w insomnia` whenever a pinned version bumps.
 *
 * Bundling sources from the isolated, exact-pinned install at `vendored/pkg/` (see its
 * `package.json`) — NOT the app's own ambient `node_modules` — so the sandbox's vetted version is
 * independent of whatever the rest of the app has installed. Run `npm ci --prefix
 * src/templating/sandbox/vendored/pkg` before this script if that install doesn't exist yet.
 *
 * "Add a vetted lib" checklist:
 *   1. Add the dependency (exact-pinned, no ^/~) to `vendored/pkg/package.json`, then run
 *      `npm install --prefix src/templating/sandbox/vendored/pkg` to update its lockfile.
 *   2. Add an entry to VENDORED_LIBS in `sandbox-vendored-libs-list.ts` (name + entry expression).
 *   3. Run `npm run sandbox:vendored:generate -w insomnia`.
 *   4. Register it in module-registry.ts SANDBOX_MODULES with `heavy: true`.
 *   5. Add a parity unit test (per-lib smoke) + a dedicated `<name>.regression.test.ts` + an e2e
 *      row, and document it in PERMISSIONS.md.
 *
 * To bump an already-vetted lib's version, prefer `npm run sandbox:vendored:upgrade -w insomnia --
 * <lib>@<version>` over steps 1-3 by hand — it also runs the chain-of-custody and guardrail checks.
 */
import { checkVendorGuardrail } from './check-sandbox-vendor-guardrail';
import { generateVendoredFile } from './sandbox-vendored-lib';
import { VENDORED_LIBS } from './sandbox-vendored-libs-list';

export { VENDORED_LIBS };

const main = async () => {
  checkVendorGuardrail(VENDORED_LIBS.map(l => l.name));
  for (const lib of VENDORED_LIBS) {
    await generateVendoredFile(lib);
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
