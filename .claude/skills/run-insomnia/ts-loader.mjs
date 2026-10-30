/**
 * ESM loader hooks that let `exec` scripts import the repo's TypeScript directly.
 *
 * Two things Node can't do on its own here:
 *   1. The smoke-test Page Objects use extensionless relative imports
 *      (`./insomnia-app`, `../launch`) - ESM requires explicit extensions.
 *   2. Node's built-in type stripping doesn't cover every file, and we want
 *      esbuild's transform for consistency with the rest of the repo.
 *
 * Deliberately transpiles per module rather than bundling: bundling collapses
 * every source file into one, so `__dirname` would resolve to the bundle's
 * location and `paths.ts`'s fixture lookups (`__dirname/../fixtures`) would break.
 */
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TS_EXT = /\.(ts|tsx|mts|cts)$/;

// Hook threads get no module-scope state from the driver, so the repo path
// arrives through register()'s `data`. esbuild then comes from the repo's
// node_modules - this file lives outside any package and cannot import it.
let REPO = null;
let esbuild = null;

export async function initialize(data) {
  REPO = data.repo;
  esbuild = createRequire(path.join(REPO, 'package.json'))('esbuild');
}

/** `?t=` cache-busting queries would otherwise break fileURLToPath. */
function toPath(url) {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  return fileURLToPath(u);
}

const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

export async function resolve(specifier, context, nextResolve) {
  // `@repo/<path>` addresses the driven checkout, so an exec script can import
  // repo sources without a relative path that depends on where it is stored.
  if (specifier.startsWith('@repo/')) {
    const base = path.join(REPO, specifier.slice('@repo/'.length));
    for (const suffix of ['', ...CANDIDATE_SUFFIXES]) {
      const candidate = base + suffix;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { url: pathToFileURL(candidate).href, format: 'module', shortCircuit: true };
      }
    }
    throw new Error('cannot resolve ' + specifier + ' under ' + REPO);
  }

  const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
  if (isRelative && !path.extname(specifier) && context.parentURL) {
    const base = path.resolve(path.dirname(toPath(context.parentURL)), specifier);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = base + suffix;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { url: pathToFileURL(candidate).href, format: 'module', shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

/**
 * The smoke-test sources are CJS-flavoured TypeScript and use `__dirname`,
 * `__filename` and `require`, none of which exist in an ES module. Injecting the
 * shims per module is what keeps `__dirname` pointing at each file's own
 * directory - the reason this loader transpiles instead of bundling.
 */
const CJS_GLOBALS = /\b(__dirname|__filename|require)\b/;
const CJS_SHIM = [
  "import { createRequire as __createRequire } from 'node:module';",
  "import { fileURLToPath as __fileURLToPath } from 'node:url';",
  "import { dirname as __pathDirname } from 'node:path';",
  'const __filename = __fileURLToPath(import.meta.url);',
  'const __dirname = __pathDirname(__filename);',
  'const require = __createRequire(import.meta.url);',
].join('\n');

export async function load(url, context, nextLoad) {
  if (!TS_EXT.test(new URL(url).pathname)) {
    return nextLoad(url, context);
  }
  const file = toPath(url);
  const source = await readFile(file, 'utf8');
  const { code } = await esbuild.transform(source, {
    loader: file.endsWith('x') ? 'tsx' : 'ts',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    sourcefile: file,
    ...(CJS_GLOBALS.test(source) ? { banner: CJS_SHIM } : {}),
  });
  return { format: 'module', source: code, shortCircuit: true };
}
