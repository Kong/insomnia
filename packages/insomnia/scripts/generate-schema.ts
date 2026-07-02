/**
 * Generates a public JSON Schema for the Insomnia v5 file format.
 *
 * The source of truth is the Zod schema in `src/common/import-v5-parser.ts`
 * (`InsomniaFileSchema`), which is the same schema used to validate `.yaml`
 * files on import/export and in git-backed repositories. We convert it to a
 * standard JSON Schema via Zod's `z.toJSONSchema()` so that humans and AI
 * agents can validate Insomnia files against a published, stable URL.
 *
 * Run with: `npm run generate:schema -w insomnia`
 *
 * Two files are written to the repo-root `schemas/` directory:
 * - `insomnia.schema.<version>.json` — a versioned, immutable historical record
 *   for the current `INSOMNIA_SCHEMA_VERSION` (e.g. `insomnia.schema.5.1.json`).
 * - `insomnia.schema.json` — a stable "latest" alias that always mirrors the
 *   current version, so the published URL never changes.
 *
 * The generated files are committed to the repo and kept in sync by a CI drift
 * check (see `.github/workflows/test.yml`). If you change the Zod schema,
 * re-run this script and commit the updated `schemas/*.json`.
 *
 * `import-v5-parser.ts` uses the `~/*` tsconfig path alias internally, which
 * the per-file `esbuild-runner` hook does not resolve. We therefore bundle it
 * with esbuild (which honours the alias) into a temp module and load that.
 */

import { webcrypto } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import esbuild from 'esbuild';
import { z } from 'zod/v4';

import { INSOMNIA_SCHEMA_VERSION } from '../src/common/insomnia-schema-migrations/schema-version';

// Some schema fields default to `crypto.randomUUID()`. Ensure the global is
// available so Zod can evaluate those defaults without throwing while it walks
// the schema. (The values themselves are stripped below — see `normalizeSchema`.)
if (!globalThis.crypto) {
  // @ts-expect-error -- assigning the Node webcrypto to the global
  globalThis.crypto = webcrypto;
}

/**
 * Fields wrapped in `z.preprocess(...)` whose inner schema carries a default
 * (so they are optional in practice) are still emitted as `required`, because
 * Zod cannot see through the preprocess wrapper when computing optionality.
 * The parser accepts these fields when absent, so the published schema must
 * not require them. Currently only `expires` on cookies is affected.
 */
const OPTIONAL_PREPROCESSED_FIELDS = new Set(['expires']);

/**
 * Recursively normalizes the generated JSON Schema:
 * - Removes `default` annotations. They don't affect validation, and one field
 *   defaults to a random UUID, which would otherwise make the output
 *   non-deterministic and break the CI drift check.
 * - Drops `OPTIONAL_PREPROCESSED_FIELDS` from `required` arrays so the schema
 *   matches what the parser actually accepts.
 */
const normalizeSchema = (node: unknown): void => {
  if (Array.isArray(node)) {
    node.forEach(normalizeSchema);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    delete obj.default;
    if (Array.isArray(obj.required)) {
      obj.required = obj.required.filter(key => !OPTIONAL_PREPROCESSED_FIELDS.has(key as string));
    }
    Object.values(obj).forEach(normalizeSchema);
  }
};

// Public, stable URL the schemas are published at (raw files on the default branch).
const SCHEMA_BASE_URL = 'https://raw.githubusercontent.com/Kong/insomnia/develop/schemas';

const SRC_DIR = path.resolve(__dirname, '../src');
const PARSER_ENTRY = path.join(SRC_DIR, 'common/import-v5-parser.ts');

// Repo-root `schemas/` directory. This script lives at
// packages/insomnia/scripts/, so go up three levels to the repo root.
const OUTPUT_DIR = path.resolve(__dirname, '../../../schemas');
// Versioned file (immutable per schema version) and the "latest" alias.
const VERSIONED_FILENAME = `insomnia.schema.${INSOMNIA_SCHEMA_VERSION}.json`;
const LATEST_FILENAME = 'insomnia.schema.json';

const bundleParser = async (): Promise<{ InsomniaFileSchema: z.ZodType }> => {
  // Write inside the project so Node can resolve `zod` from node_modules.
  const tmpFile = path.join(__dirname, `.tmp-parser-${process.pid}.cjs`);
  await esbuild.build({
    entryPoints: [PARSER_ENTRY],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: tmpFile,
    // Resolve the `~/*` alias the same way the app does.
    alias: { '~': SRC_DIR },
    // Keep zod external so we share the exact instance used here.
    external: ['zod', 'zod/*'],
    logLevel: 'warning',
  });
  try {
    return require(tmpFile);
  } finally {
    rmSync(tmpFile, { force: true });
  }
};

const main = async () => {
  const { InsomniaFileSchema } = await bundleParser();

  const generated = z.toJSONSchema(InsomniaFileSchema, {
    // Validate the data as authored by a user (defaults stay optional).
    io: 'input',
    // Don't throw on constructs that have no exact JSON Schema representation;
    // fall back to a permissive shape instead.
    unrepresentable: 'any',
    // Inline cycles are not allowed; reuse $defs/$ref for the recursive
    // request-group / JSON value schemas.
    cycles: 'ref',
  });

  normalizeSchema(generated);

  // The two files are byte-identical apart from their `$id`, which points each
  // one at its own published URL.
  const buildSchema = (filename: string) => ({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${SCHEMA_BASE_URL}/${filename}`,
    title: 'Insomnia File',
    description:
      `JSON Schema for Insomnia v${INSOMNIA_SCHEMA_VERSION} files (.insomnia / .yaml). ` +
      'Validates collections, API specs, mock servers, global environments and MCP clients. ' +
      'Generated from the Insomnia source of truth — do not edit by hand.',
    ...generated,
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const filename of [VERSIONED_FILENAME, LATEST_FILENAME]) {
    const outputPath = path.join(OUTPUT_DIR, filename);
    writeFileSync(outputPath, `${JSON.stringify(buildSchema(filename), null, 2)}\n`);


    console.log(`Wrote ${outputPath}`);
  }
};

main().catch(err => {
   
  console.error(err);
  process.exit(1);
});
