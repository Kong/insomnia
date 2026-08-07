import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import { parsePluginPermissions } from './permissions';
import { PLUGIN_MANIFEST_SCHEMA_VERSION, PLUGIN_PERMISSIONS_SCHEMA } from './permissions-schema';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(PLUGIN_PERMISSIONS_SCHEMA);

// Each case is a value for `insomnia.permissions` that is PRESENT (absence is the separate "baseline"
// path the parser handles, not something this schema describes). `clean` = the parser accepts it with
// zero warnings; that must equal schema validity.
const presentPermissionsCases: { name: string; permissions: unknown; clean: boolean }[] = [
  {
    name: 'valid modules + capabilities',
    permissions: { modules: ['events', 'crypto'], capabilities: ['storage'] },
    clean: true,
  },
  { name: 'declared but empty', permissions: {}, clean: true },
  { name: 'duplicate entries (deduped, allowed)', permissions: { modules: ['events', 'events', 'path'] }, clean: true },
  { name: 'unknown module name (grant != availability)', permissions: { modules: ['left-pad'] }, clean: true },
  { name: 'unknown key inside permissions (ignored)', permissions: { modules: ['events'], extra: true }, clean: true },
  { name: 'non-array axis', permissions: { modules: 'events' }, clean: false },
  { name: 'non-string / empty entries', permissions: { modules: ['events', 123, ''] }, clean: false },
  { name: 'empty-string entry', permissions: { modules: [''] }, clean: false },
  { name: 'non-string capability entry', permissions: { capabilities: ['storage', 3] }, clean: false },
  { name: 'permissions is a string', permissions: 'nope', clean: false },
  { name: 'permissions is an array', permissions: [], clean: false },
  { name: 'permissions is null', permissions: null, clean: false },
];

describe('PLUGIN_PERMISSIONS_SCHEMA', () => {
  it('is a compilable JSON Schema and is version-stamped', () => {
    expect(typeof validate).toBe('function');
    expect(PLUGIN_MANIFEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(PLUGIN_PERMISSIONS_SCHEMA.$id).toContain(`v${PLUGIN_MANIFEST_SCHEMA_VERSION}`);
  });

  // The lockstep invariant: the formal schema and the lenient runtime parser must agree on exactly
  // which present `permissions` blocks are clean. If someone changes one without the other, this fails.
  it.each(presentPermissionsCases)('schema validity matches parser cleanliness: $name', ({ permissions, clean }) => {
    const schemaValid = validate(permissions);
    const parserClean = parsePluginPermissions({ permissions }).warnings.length === 0;
    expect(parserClean, 'parser cleanliness should match the case table').toBe(clean);
    expect(schemaValid, 'schema validity should match parser cleanliness').toBe(clean);
  });
});
