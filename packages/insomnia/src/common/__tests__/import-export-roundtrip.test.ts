import fs from 'node:fs';
import path from 'node:path';

import { database as db, models, services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// eslint-disable-next-line no-restricted-imports
import { resetV4Counter } from '../../../../insomnia-data/__mocks__/uuid';
import * as importUtil from '../import';
import { getInsomniaV5DataExport } from '../insomnia-v5';

// The shared test setup mocks `uuid` with a finite pool and shares one NeDB
// instance across tests. Wipe every collection and reset the id pool per test so
// each fixture starts from a clean slate with the full pool for its two
// round-trips (the mocked ids are deterministic, so a clean DB avoids collisions).
beforeEach(async () => {
  await Promise.all(models.types().map(type => db.removeWhere(type, {})));
  resetV4Counter();
});

const FIXTURE_DIR = path.join(__dirname, '..', '__fixtures__', 'insomnia-v5-roundtrip');

// Real-world Insomnia exports (airline demo) covering every workspace type:
// design specs, collections, environments and an MCP client, plus a raw
// OpenAPI document that imports as a design doc.
const fixtures = fs.readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.yaml'));

// Strip the fields that are legitimately regenerated on every import (ids and
// timestamps) so two exports can be compared for structural/semantic equality.
const VOLATILE_KEYS = new Set(['id', 'created', 'modified']);
// Model ids have the form `<prefix>_<32 hex>`. They are regenerated on every
// import and can appear embedded inside string values too - e.g. a `{% response
// 'body', 'req_...' %}` template tag that references another request. The
// importer correctly rewrites those references, so the reference is stable, only
// its opaque value changes. Mask them so the comparison is about structure.
const EMBEDDED_ID = /\b[a-z]{2,}_[0-9a-f]{32}\b/g;
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    // Sort arrays by their canonical content so the comparison is insensitive to
    // sibling ordering. The export currently emits collection items and
    // sub-environments in database insertion order, which is not stable across
    // round-trips; making the export order deterministic (by metaSortKey) is
    // tracked as a separate change, so this test asserts data preservation only.
    return value
      .map(normalize)
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = VOLATILE_KEYS.has(key) ? '<normalized>' : normalize(val);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.replace(EMBEDDED_ID, '<id>');
  }
  return value;
};

// Imports a YAML string into a fresh project and exports every workspace it
// created back to v5 YAML.
const importThenExport = async (contentStr: string): Promise<string[]> => {
  const scanResult = await importUtil.scanResources([{ contentStr }]);
  expect(scanResult.flatMap(r => r.errors)).toEqual([]);

  const project = await services.project.create();
  const workspaces = await importUtil.importResourcesToProject({ projectId: project._id });
  expect(workspaces.length).toBeGreaterThan(0);

  return Promise.all(
    workspaces.map(workspace =>
      getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments: true }),
    ),
  );
};

describe('import/export round-trip is deterministic on real exports', () => {
  it.each(fixtures)('%s reaches a stable fixed point after a second round-trip', async fixture => {
    const original = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');

    // First round-trip: import the (possibly non-canonical) source and export
    // it to its canonical v5 form.
    const [firstExport] = await importThenExport(original);
    expect(firstExport).not.toBe('');

    // Second round-trip: re-importing and re-exporting the canonical form must
    // produce the exact same document (a fixed point). The design-doc wrapper
    // bug breaks this - the spec contents grow an extra Insomnia envelope each
    // round.
    const [secondExport] = await importThenExport(firstExport);

    expect(normalize(parse(secondExport))).toEqual(normalize(parse(firstExport)));
  });

  it('never wraps a design-doc spec in the Insomnia v5 envelope', async () => {
    const designFixtures = fixtures.filter(f => fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8').startsWith('type: spec.insomnia.rest/5.0'));
    expect(designFixtures.length).toBeGreaterThan(0);

    for (const fixture of designFixtures) {
      const original = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
      const [firstExport] = await importThenExport(original);
      const parsed = parse(firstExport);

      // spec.contents must be the OpenAPI document, not the Insomnia envelope.
      const contents = parsed?.spec?.contents;
      expect(contents, `${fixture} should export spec.contents`).toBeTruthy();
      expect(contents.type, `${fixture} leaked the v5 envelope into spec.contents`).toBeUndefined();
      expect(contents.schema_version, `${fixture} leaked schema_version into spec.contents`).toBeUndefined();
      expect(contents.openapi || contents.swagger, `${fixture} should be an OpenAPI/Swagger doc`).toBeTruthy();
    }
  });
});
