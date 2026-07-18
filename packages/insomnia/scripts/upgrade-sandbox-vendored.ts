/**
 * Bump one sandbox-vendored lib's pinned version (sandbox plan M3), end-to-end:
 *
 *   npm run sandbox:vendored:upgrade -w insomnia -- <lib>@<version>
 *   e.g. npm run sandbox:vendored:upgrade -w insomnia -- uuid@9.1.0
 *
 * Updates the exact pin in `vendored/pkg/package.json`, reinstalls the isolated pkg, verifies the
 * version an engineer asked for is exactly what got installed and exactly what ended up baked into
 * the regenerated bundle (chain-of-custody, three-way), checks the sandbox pin still doesn't exceed
 * the app's own resolved version, regenerates just that lib's `<name>.generated.ts`, and runs its
 * dedicated regression suite — leaving a ready-to-commit diff or a loud, specific failure.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { checkVendorGuardrail } from './check-sandbox-vendor-guardrail';
import { generateVendoredFile, INSOMNIA_ROOT, installedVersion, PKG_DIR } from './sandbox-vendored-lib';
import { VENDORED_LIBS } from './sandbox-vendored-libs-list';

const PKG_JSON_PATH = path.join(PKG_DIR, 'package.json');
const PKG_LOCK_PATH = path.join(PKG_DIR, 'package-lock.json');

const parseArg = (arg: string | undefined): { name: string; version: string } => {
  const at = arg?.lastIndexOf('@') ?? -1;
  if (!arg || at <= 0) {
    throw new Error(`Usage: npm run sandbox:vendored:upgrade -w insomnia -- <lib>@<version> (got '${arg ?? ''}')`);
  }
  const name = arg.slice(0, at);
  const version = arg.slice(at + 1);
  if (!VENDORED_LIBS.some(l => l.name === name)) {
    throw new Error(`'${name}' isn't a vetted sandbox lib. Known libs: ${VENDORED_LIBS.map(l => l.name).join(', ')}. Add it to VENDORED_LIBS in generate-sandbox-vendored.ts first.`);
  }
  return { name, version };
};

const writePin = (name: string, version: string): void => {
  const pkgJson = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8')) as { dependencies: Record<string, string> };
  if (!(name in pkgJson.dependencies)) {
    throw new Error(`'${name}' has no existing pin in ${path.relative(INSOMNIA_ROOT, PKG_JSON_PATH)} — this script only bumps libs already vetted, it won't silently add new ones.`);
  }
  pkgJson.dependencies[name] = version;
  fs.writeFileSync(PKG_JSON_PATH, `${JSON.stringify(pkgJson, null, 2)}\n`);
};

const main = async () => {
  const { name, version: requestedVersion } = parseArg(process.argv[2]);
  const originalPkgJson = fs.readFileSync(PKG_JSON_PATH, 'utf8');
  const originalLockfile = fs.existsSync(PKG_LOCK_PATH) ? fs.readFileSync(PKG_LOCK_PATH, 'utf8') : null;

  try {
    console.log(`[upgrade-sandbox-vendored] pinning '${name}' to ${requestedVersion} in ${path.relative(INSOMNIA_ROOT, PKG_JSON_PATH)}`);
    writePin(name, requestedVersion);

    console.log('[upgrade-sandbox-vendored] npm install --prefix vendored/pkg (updates lockfile)');
    execFileSync('npm', ['install', '--prefix', PKG_DIR], { stdio: 'inherit' });

    // Chain-of-custody check #1: what was actually installed matches what was requested.
    const installed = installedVersion(name);
    if (installed !== requestedVersion) {
      throw new Error(`Chain-of-custody check failed: requested '${name}@${requestedVersion}' but npm installed '${installed}' (a range/tag was likely resolved instead of an exact version — use an exact version string).`);
    }

    console.log('[upgrade-sandbox-vendored] checking guardrail (sandbox pin must not exceed the app\'s resolved version)');
    checkVendorGuardrail([name]);

    console.log(`[upgrade-sandbox-vendored] regenerating ${name}.generated.ts`);
    const lib = VENDORED_LIBS.find(l => l.name === name)!;
    const generatedVersion = await generateVendoredFile(lib);

    // Chain-of-custody check #2: what got baked into the checked-in bundle matches both prior checks.
    if (generatedVersion !== installed) {
      throw new Error(`Chain-of-custody check failed: installed '${name}@${installed}' but the generated bundle recorded '${generatedVersion}'.`);
    }
    console.log(`[upgrade-sandbox-vendored] chain-of-custody OK: requested ${requestedVersion} === installed ${installed} === generated ${generatedVersion}`);

    const regressionTestPath = path.join(INSOMNIA_ROOT, 'src', 'templating', 'sandbox', 'vendored', `${name}.regression.test.ts`);
    console.log(`[upgrade-sandbox-vendored] running regression suite: ${path.relative(INSOMNIA_ROOT, regressionTestPath)}`);
    // Regression suites are excluded from the default vitest.config.ts (see its `exclude`) so they
    // don't run on every unrelated `npm test` — use their dedicated config here instead.
    execFileSync('npx', ['vitest', 'run', '--config', 'vitest.sandbox-vendored-regression.config.ts', regressionTestPath], { stdio: 'inherit', cwd: INSOMNIA_ROOT });

    console.log('\n[upgrade-sandbox-vendored] done. Review and commit:');
    console.log(`  ${path.relative(INSOMNIA_ROOT, PKG_JSON_PATH)}`);
    console.log(`  ${path.relative(INSOMNIA_ROOT, PKG_LOCK_PATH)}`);
    console.log(`  src/templating/sandbox/vendored/${name}.generated.ts`);
  } catch (err) {
    // Leave the working tree as it was before this run rather than a half-upgraded, uncommittable mess.
    fs.writeFileSync(PKG_JSON_PATH, originalPkgJson);
    if (originalLockfile !== null) {
      fs.writeFileSync(PKG_LOCK_PATH, originalLockfile);
    }
    console.error(`\n[upgrade-sandbox-vendored] rolled back ${path.relative(INSOMNIA_ROOT, PKG_JSON_PATH)} and its lockfile to their prior state.`);
    throw err;
  }
};

main().catch(err => {
  console.error(`\n[upgrade-sandbox-vendored] FAILED: ${(err as Error).message}`);
  process.exit(1);
});
