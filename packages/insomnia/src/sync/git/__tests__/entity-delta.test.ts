import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

import { applyEntityDelta, computeEntityDelta, isEmptyDelta } from '../entity-delta';

const request = (
  { id, name, url = `https://example.com/${id}`, extra = '' }: { id: string; name: string; url?: string; extra?: string },
  indent = '  ',
) => `${indent}- url: ${url}
${indent}  name: ${name}
${indent}  meta:
${indent}    id: ${id}
${indent}    created: 1000
${indent}    modified: 1000
${indent}  method: GET
${indent}  headers:
${indent}    - name: X-Test
${indent}      value: one${extra}`;

const folder = ({ id, name, children }: { id: string; name: string; children: string }, indent = '  ') => `${indent}- name: ${name}
${indent}  meta:
${indent}    id: ${id}
${indent}    created: 1000
${indent}    modified: 1000
${indent}  children:
${children}`;

const file = ({ items = '', name = 'Test Collection', collection }: { items?: string; name?: string; collection?: string }) => `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: ${name}
meta:
  id: wrk_test
  created: 1000
  modified: 1000
${collection ?? `collection:
${items}`}
cookieJar:
  name: Default Jar
  meta:
    id: jar_test
    created: 1000
    modified: 1000
environments:
  name: Base Environment
  meta:
    id: env_test
    created: 1000
    modified: 1000
`;

const base = file({ items: `${request({ id: 'req_a', name: 'A' })}\n${request({ id: 'req_b', name: 'B' })}` });

describe('computeEntityDelta', () => {
  it('is empty when nothing changed', () => {
    expect(isEmptyDelta(computeEntityDelta(base, base))).toBe(true);
  });

  it('ignores the timestamps the importer fills in', () => {
    const touched = base.replace(/created: 1000/g, 'created: 9999').replace(/modified: 1000/g, 'modified: 9999');
    expect(isEmptyDelta(computeEntityDelta(base, touched))).toBe(true);
  });

  it('reports only the entity whose content changed', () => {
    const changed = base.replace('name: B', 'name: B renamed');

    expect(computeEntityDelta(base, changed)).toEqual({
      leaves: [],
      replaced: ['req_b'],
      removed: [],
      added: [],
    });
  });

  it('reports the root scalars it cannot replace wholesale', () => {
    const renamed = base.replace('name: Test Collection', 'name: Renamed');

    expect(computeEntityDelta(base, renamed).leaves).toEqual(['name']);
  });

  it('reports added, removed and moved entities', () => {
    const withoutB = file({ items: request({ id: 'req_a', name: 'A' }) });
    const withC = file({ items: `${request({ id: 'req_a', name: 'A' })}\n${request({ id: 'req_c', name: 'C' })}` });

    expect(computeEntityDelta(base, withoutB).removed).toEqual(['req_b']);
    expect(computeEntityDelta(base, withC).added).toEqual(['req_c']);

    const nested = file({
      items: folder({ id: 'fld_1', name: 'Folder', children: request({ id: 'req_a', name: 'A' }, '      ') }),
    });
    const moved = computeEntityDelta(base, nested);
    expect(moved.removed).toContain('req_a');
    // The folder carries the request with it; only the folder is inserted.
    expect(moved.added).toEqual(['fld_1']);
  });

  it('reports a different file as unpatchable', () => {
    const other = base.replace('id: wrk_test', 'id: wrk_other');
    const delta = computeEntityDelta(base, other);
    expect(delta.unpatchable).toMatch(/workspace id changed/);
    expect(isEmptyDelta(delta)).toBe(false);
  });

  it('does not report descendants of an entity it already replaces', () => {
    const nested = file({
      items: folder({
        id: 'fld_1',
        name: 'Folder',
        children: request({ id: 'req_a', name: 'A' }, '      '),
      }),
    });
    const renamed = nested.replace('name: Folder', 'name: Folder renamed');
    const delta = computeEntityDelta(nested, renamed);

    expect(delta.replaced).toEqual(['fld_1']);
  });
});

describe('applyEntityDelta', () => {
  it('returns the DB text when the file is canonical', () => {
    const changed = base.replace('name: B', 'name: B renamed');
    expect(applyEntityDelta(base, changed, computeEntityDelta(base, changed))).toBe(changed);
  });

  it('keeps comments, indentation, unknown fields and hand order of untouched entities', () => {
    const handEdited = `type: collection.insomnia.rest/5.0   # kept
schema_version: "5.1"
name: Test Collection
meta:
  id: wrk_test
  created: 1000
  modified: 1000
collection:
    # the collection, by hand
    - url: https://example.com/req_b
      name: B
      method: GET
      futureField: 42
      meta:
        id: req_b
        created: 1000
        modified: 1000
    - url: https://example.com/req_a
      name: A
      meta: {id: req_a, created: 1000, modified: 1000}
      method: GET
cookieJar:
  name: Default Jar
  meta:
    id: jar_test
    created: 1000
    modified: 1000
environments:
  name: Base Environment
  meta:
    id: env_test
    created: 1000
    modified: 1000
`;

    const changed = base.replace('name: A', 'name: A renamed');
    const patched = applyEntityDelta(handEdited, changed, computeEntityDelta(base, changed));

    expect(patched).not.toBeNull();
    expect(patched).toContain('type: collection.insomnia.rest/5.0   # kept');
    expect(patched).toContain('    # the collection, by hand');
    expect(patched).toContain('      futureField: 42');
    expect(patched).toContain(`      meta:
        id: req_b
        created: 1000
        modified: 1000`);
    expect(patched).toContain(`    - url: https://example.com/req_a
      name: A renamed
      meta:
        id: req_a
        created: 1000
        modified: 1000
      method: GET`);
    expect(patched!.indexOf('req_b')).toBeLessThan(patched!.indexOf('req_a'));
  });

  it('removes an entity together with its block', () => {
    const withoutB = file({ items: request({ id: 'req_a', name: 'A' }) });
    const patched = applyEntityDelta(base, withoutB, computeEntityDelta(base, withoutB));

    expect(patched).toBe(withoutB);
  });

  it('drops the collection key when the last entity goes', () => {
    const empty = file({ collection: '' });
    const onlyA = file({ items: request({ id: 'req_a', name: 'A' }) });
    const patched = applyEntityDelta(onlyA, empty, computeEntityDelta(onlyA, empty));

    expect(parseDocument(patched!).toJSON()).toEqual(parseDocument(empty).toJSON());
  });

  it('inserts a new entity after its preceding sibling', () => {
    const withC = file({
      items: `${request({ id: 'req_a', name: 'A' })}\n${request({ id: 'req_b', name: 'B' })}\n${request({ id: 'req_c', name: 'C' })}`,
    });
    const patched = applyEntityDelta(base, withC, computeEntityDelta(base, withC));

    expect(patched).toBe(withC);
  });

  it('creates the container when the file has none', () => {
    const withoutCollection = file({ collection: '' });
    const withOne = file({ items: request({ id: 'req_a', name: 'A' }) });
    const patched = applyEntityDelta(withoutCollection, withOne, computeEntityDelta(withoutCollection, withOne));

    expect(patched).not.toBeNull();
    expect(parseDocument(patched!).toJSON()).toEqual(parseDocument(withOne).toJSON());
  });

  it('turns an empty flow sequence into a block sequence', () => {
    const empty = file({ collection: 'collection: []' });
    const withOne = file({ items: request({ id: 'req_a', name: 'A' }) });
    const patched = applyEntityDelta(empty, withOne, computeEntityDelta(empty, withOne));

    expect(patched).not.toBeNull();
    expect(parseDocument(patched!).toJSON()).toEqual(parseDocument(withOne).toJSON());
    expect(patched).toContain('collection:\n  - url:');
  });

  it('patches a root scalar in place without touching the rest', () => {
    const renamed = base.replace('name: Test Collection', 'name: Renamed');
    const patched = applyEntityDelta(base, renamed, computeEntityDelta(base, renamed));

    expect(patched).toBe(renamed);
  });

  it('moves an entity between containers', () => {
    const nested = file({
      items: folder({ id: 'fld_1', name: 'Folder', children: request({ id: 'req_a', name: 'A' }, '      ') }),
    });
    const patched = applyEntityDelta(base, nested, computeEntityDelta(base, nested));

    expect(patched).not.toBeNull();
    expect(parseDocument(patched!).toJSON()).toEqual(parseDocument(nested).toJSON());
  });

  it('refuses to patch an entity it cannot find', () => {
    const changed = base.replace('name: B', 'name: B renamed');
    const delta = computeEntityDelta(base, changed);
    delta.replaced = ['req_missing'];

    expect(applyEntityDelta(base, changed, delta)).toBeNull();
  });
});

describe('review regressions', () => {
  it('replaces a folder without also splicing the child it lost', () => {
    const nested = file({
      items: folder({ id: 'fld_1', name: 'Folder', children: request({ id: 'req_a', name: 'A' }, '      ') }),
    });
    const renamed = file({
      items: `  - name: Folder renamed
    meta:
      id: fld_1
      created: 1000
      modified: 1000`,
    });

    const delta = computeEntityDelta(nested, renamed);
    expect(delta.replaced).toEqual(['fld_1']);
    expect(delta.removed).toEqual([]);
    expect(applyEntityDelta(nested, renamed, delta)).toBe(renamed);
  });

  it('replaces a block scalar without joining it to the next key', () => {
    const withBlockScalar = file({
      items: request({ id: 'req_a', name: 'A' }),
    }).replace(
      '  modified: 1000\ncollection:',
      '  modified: 1000\n  description: |\n    line one\n    line two\ncollection:',
    );
    const inline = withBlockScalar.replace('  description: |\n    line one\n    line two\n', '  description: short\n');

    const patched = applyEntityDelta(withBlockScalar, inline, computeEntityDelta(withBlockScalar, inline));

    expect(patched).toBe(inline);
  });

  it('inserts a root value the file does not carry', () => {
    const withEmptyDescription = file({ items: request({ id: 'req_a', name: 'A' }) }).replace(
      '  modified: 1000\ncollection:',
      '  modified: 1000\n  description: ""\ncollection:',
    );
    const withoutDescription = withEmptyDescription.replace('  description: ""\n', '');
    const filled = withEmptyDescription.replace('  description: ""', '  description: shop');

    const patched = applyEntityDelta(
      withoutDescription,
      filled,
      computeEntityDelta(withEmptyDescription, filled),
    );

    expect(patched).not.toBeNull();
    const parsed = parseDocument(patched!).toJSON() as { meta?: { description?: unknown } };
    expect(parsed.meta?.description).toBe('shop');
    expect(patched).toContain('collection:');
  });

  it('refuses to splice a flow-style collection', () => {
    const flow = `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Flow
meta:
  id: wrk_test
  created: 1000
  modified: 1000
collection: [{url: https://example.com/a, name: A, meta: {id: req_a}}, {url: https://example.com/b, name: B, meta: {id: req_b}}]
environments:
  name: Base Environment
  meta:
    id: env_test
    created: 1000
    modified: 1000
`;
    const renamed = flow.replace('name: A,', 'name: A renamed,');

    expect(applyEntityDelta(flow, renamed, computeEntityDelta(flow, renamed))).toBeNull();
  });

  it('treats meta.sortKey as content', () => {
    const keyed = (a: number, b: number) =>
      file({
        items: [request({ id: 'req_a', name: 'A' }), request({ id: 'req_b', name: 'B' })]
          .map((block, index) =>
            block.replace('      modified: 1000', `      modified: 1000\n      sortKey: ${index === 0 ? a : b}`),
          )
          .join('\n'),
      });

    expect(computeEntityDelta(keyed(1, 2), keyed(2, 1)).replaced.sort()).toEqual(['req_a', 'req_b']);
  });

  it('inserts after a sibling that ends the file without a newline', () => {
    const fileEndingAtCollection = `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Test Collection
meta:
  id: wrk_test
  created: 1000
  modified: 1000
collection:
  - url: https://example.com/a
    name: A
    meta:
      id: req_a
      created: 1000
      modified: 1000
    method: GET`;
    const baseWithNewline = `${fileEndingAtCollection}\n`;
    const twoRequests = `${baseWithNewline}  - url: https://example.com/b
    name: B
    meta:
      id: req_b
      created: 2000
      modified: 2000
    method: GET
`;

    const patched = applyEntityDelta(
      fileEndingAtCollection,
      twoRequests,
      computeEntityDelta(baseWithNewline, twoRequests),
    );

    expect(patched).toBe(twoRequests);
  });

  it('keeps the container when its items are replaced in one change', () => {
    const onlyA = file({ items: request({ id: 'req_a', name: 'A' }) });
    const onlyC = file({ items: request({ id: 'req_c', name: 'C' }) });

    const patched = applyEntityDelta(onlyA, onlyC, computeEntityDelta(onlyA, onlyC));

    expect(patched).not.toBeNull();
    expect(patched).toContain('collection:\n  - url: https://example.com/req_c');
    expect(parseDocument(patched!).toJSON()).toEqual(parseDocument(onlyC).toJSON());
  });

  it('removes a folder and its children in one edit', () => {
    const withFolder = file({
      items: `${folder({ id: 'fld_1', name: 'Folder', children: request({ id: 'req_a', name: 'A' }, '      ') })}\n${request({ id: 'req_b', name: 'B' })}`,
    });
    const withoutFolder = file({ items: request({ id: 'req_b', name: 'B' }) });

    const delta = computeEntityDelta(withFolder, withoutFolder);

    expect(delta.removed).toEqual(['fld_1']);
    expect(applyEntityDelta(withFolder, withoutFolder, delta)).toBe(withoutFolder);
  });
});
