/**
 * P1-B: the versioned, canonical JSON Schema for a plugin's `insomnia.permissions` manifest block.
 *
 * `parsePluginPermissions` (permissions.ts) is the *lenient runtime* validator — it never throws, and
 * degrades a malformed manifest to baseline access with a human-readable warning. This schema is the
 * *formal contract* that same validator enforces: a manifest is "clean" (parses with zero warnings)
 * exactly when it validates against this schema. It's exported so plugin authors, editor tooling, and
 * docs can reference one source of truth, and it's version-stamped so the contract can evolve
 * deliberately. `permissions-schema.test.ts` locks the parser and this schema in lockstep so they
 * can't drift.
 *
 * Note the deliberate leniencies that match the parser (and are therefore NOT schema violations):
 *   - unknown module/capability *names* are allowed (grant vs. availability are separate concerns);
 *   - duplicate entries are allowed (the parser de-duplicates silently);
 *   - unknown keys inside `permissions` are ignored (no `additionalProperties: false`).
 */

/** Bump when the manifest contract changes in a way authors must react to. */
export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1;

/** A non-empty-string array axis (`modules` / `capabilities`). */
const stringArrayAxis = {
  type: 'array',
  items: { type: 'string', minLength: 1 },
} as const;

/**
 * JSON Schema (draft-07) for the value of `insomnia.permissions`. Validate the `permissions` object
 * itself against this (not the whole `insomnia` block).
 */
export const PLUGIN_PERMISSIONS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: `https://insomnia.rest/schemas/plugin-permissions/v${PLUGIN_MANIFEST_SCHEMA_VERSION}.json`,
  title: 'Insomnia plugin permissions',
  type: 'object',
  properties: {
    modules: stringArrayAxis,
    capabilities: stringArrayAxis,
  },
  // Intentionally no `additionalProperties: false`, `uniqueItems`, or name enums — see the module
  // docstring: the runtime parser tolerates those, so the formal contract must too.
} as const;
