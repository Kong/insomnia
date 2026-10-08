import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { applyEntityChange } from './entity-splice';

const ENV_ID = 'env_base';
const SUB_ENV_ID = 'env_sub';

function collectionFile(environments: Record<string, unknown>, collection: unknown[] = []) {
  return stringify({
    type: 'collection.insomnia.rest/5.0',
    name: 'My Collection',
    meta: { id: 'wrk_1' },
    collection,
    environments,
  });
}

const BASE_ENV = { name: 'Base Environment', meta: { id: ENV_ID } };
const req = (id: string, url = `https://example.com/${id}`) => ({ name: id, url, method: 'GET', meta: { id } });
const folder = (id: string, children: unknown[], name = id) => ({ name, meta: { id }, children });

// Flattens a collection tree to "parentId>id" strings so both placement and duplication are visible.
function placements(nodes: any[], parent = 'root'): string[] {
  return (nodes ?? []).flatMap(node => [`${parent}>${node.meta.id}`, ...placements(node.children, node.meta.id)]);
}

describe('applyEntityChange - collection tree', () => {
  it("changes a folder's own fields without touching its children", () => {
    const base = collectionFile(BASE_ENV, [folder('fld_a', [req('req_1', 'https://old')], 'Old name')]);
    const source = collectionFile(BASE_ENV, [folder('fld_a', [req('req_1', 'https://new')], 'New name')]);

    const result = parse(applyEntityChange(base, source, 'fld_a'));

    expect(result.collection[0].name).toBe('New name');
    expect(result.collection[0].children[0].url).toBe('https://old');
  });

  it('inserts a newly added folder as an empty shell, leaving its added children to their own cards', () => {
    const base = collectionFile(BASE_ENV, []);
    const source = collectionFile(BASE_ENV, [folder('fld_a', [req('req_1')])]);

    const result = parse(applyEntityChange(base, source, 'fld_a'));

    expect(placements(result.collection)).toEqual(['root>fld_a']);
  });

  it('removes a folder (and therefore its children) when source no longer has it', () => {
    const base = collectionFile(BASE_ENV, [folder('fld_a', [req('req_1')]), req('req_2')]);
    const source = collectionFile(BASE_ENV, [req('req_2')]);

    const result = parse(applyEntityChange(base, source, 'fld_a'));

    expect(placements(result.collection)).toEqual(['root>req_2']);
  });

  it('moves a request that sits in a different folder in source instead of duplicating it', () => {
    const base = collectionFile(BASE_ENV, [folder('fld_a', [req('req_1', 'https://old')]), folder('fld_b', [])]);
    const source = collectionFile(BASE_ENV, [folder('fld_a', []), folder('fld_b', [req('req_1', 'https://new')])]);

    const result = parse(applyEntityChange(base, source, 'req_1'));

    expect(placements(result.collection)).toEqual(['root>fld_a', 'root>fld_b', 'fld_b>req_1']);
    expect(result.collection[1].children[0].url).toBe('https://new');
  });

  it('reuses an ancestor folder that was moved in source instead of creating a duplicate shell', () => {
    // fld_p moved from root into fld_q in source (unstaged move), while its child req_1 also changed.
    const base = collectionFile(BASE_ENV, [folder('fld_p', [req('req_1', 'https://old')]), folder('fld_q', [])]);
    const source = collectionFile(BASE_ENV, [folder('fld_q', [folder('fld_p', [req('req_1', 'https://new')])])]);

    const result = parse(applyEntityChange(base, source, 'req_1'));

    expect(placements(result.collection)).toEqual(['root>fld_p', 'fld_p>req_1', 'root>fld_q']);
    expect(result.collection[0].children[0].url).toBe('https://new');
  });

  it('keeps an unmoved request in its original position', () => {
    const base = collectionFile(BASE_ENV, [req('req_1'), req('req_2', 'https://old'), req('req_3')]);
    const source = collectionFile(BASE_ENV, [req('req_1'), req('req_2', 'https://new'), req('req_3')]);

    const result = parse(applyEntityChange(base, source, 'req_2'));

    expect(placements(result.collection)).toEqual(['root>req_1', 'root>req_2', 'root>req_3']);
    expect(result.collection[1].url).toBe('https://new');
  });
});

describe('applyEntityChange - base environment', () => {
  it('drops a field that is absent from the source (eg. unstaging an added `data` block)', () => {
    const head = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID } });
    const index = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID }, data: { apiBaseUrl: 'https://api.example.com' } });

    const result = parse(applyEntityChange(index, head, ENV_ID));

    expect(result.environments).toEqual({ name: 'Base Environment', meta: { id: ENV_ID } });
  });

  it('adds a field that only exists in the source (eg. staging an added `data` block)', () => {
    const index = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID } });
    const workdir = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID }, data: { apiBaseUrl: 'https://api.example.com' } });

    const result = parse(applyEntityChange(index, workdir, ENV_ID));

    expect(result.environments.data).toEqual({ apiBaseUrl: 'https://api.example.com' });
  });

  it("keeps the base's sub-environments instead of pulling in the source's", () => {
    const baseSub = { name: 'Staging', meta: { id: SUB_ENV_ID }, data: { host: 'staging' } };
    const sourceSub = { name: 'Staging', meta: { id: SUB_ENV_ID }, data: { host: 'changed' } };
    const base = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID }, data: { a: 1 }, subEnvironments: [baseSub] });
    const source = collectionFile({ name: 'Base Environment', meta: { id: ENV_ID }, subEnvironments: [sourceSub] });

    const result = parse(applyEntityChange(base, source, ENV_ID));

    expect(result.environments.data).toBeUndefined();
    expect(result.environments.subEnvironments).toEqual([baseSub]);
  });

  it('removes the whole environments block when source has none (eg. discarding a never-committed one)', () => {
    const base = collectionFile({ ...BASE_ENV, subEnvironments: [{ name: 'Staging', meta: { id: SUB_ENV_ID } }] });
    const source = stringify({ type: 'collection.insomnia.rest/5.0', name: 'My Collection', meta: { id: 'wrk_1' } });

    const result = parse(applyEntityChange(base, source, ENV_ID));

    expect(result.environments).toBeUndefined();
  });
});

describe('applyEntityChange - file-level sections', () => {
  const mockFile = stringify({
    type: 'mock.insomnia.rest/5.0',
    schema_version: '5.1',
    name: 'Mock',
    meta: { id: 'wrk_m' },
    server: { url: 'https://mock', useInsomniaCloud: false },
    routes: [{ name: '/users', meta: { id: 'mock-route_1' } }],
  });

  it("stages a brand-new file's mock server on its own, with the file identity carried along", () => {
    const result = parse(applyEntityChange('', mockFile, 'file:server'));

    expect(Object.keys(result)).toEqual(['type', 'schema_version', 'name', 'meta', 'server']);
    expect(result.server.url).toBe('https://mock');
  });

  it('replaces a whole section, or removes it when source has none', () => {
    const base = collectionFile(BASE_ENV, []);
    const withSuites = stringify({ ...parse(base), testSuites: [{ name: 's', meta: { id: 'uts_1' }, tests: [] }] });
    const withCerts = stringify({ ...parse(base), certificates: [{ path: '/ca.pem', meta: { id: 'crt_1' } }] });

    expect(parse(applyEntityChange(base, withSuites, 'file:testSuites')).testSuites).toHaveLength(1);
    expect(parse(applyEntityChange(withCerts, base, 'file:certificates')).certificates).toBeUndefined();
  });

  it('changes the workspace identity without touching any entity', () => {
    const renamed = stringify({ ...parse(mockFile), name: 'Mock v2', routes: [] });

    const result = parse(applyEntityChange(mockFile, renamed, 'file:workspace'));

    expect(result.name).toBe('Mock v2');
    expect(result.routes).toHaveLength(1);
  });
});

describe('applyEntityChange - top-level key order', () => {
  it('places a newly staged section where source has it, not at the end of the file', () => {
    const source = stringify({
      type: 'mock.insomnia.rest/5.0',
      name: 'Mock',
      meta: { id: 'wrk_m' },
      server: { url: 'https://mock', useInsomniaCloud: false },
      routes: [{ name: '/users', meta: { id: 'mock-route_1' } }],
    });
    const baseWithRouteOnly = applyEntityChange('', source, 'mock-route_1');

    const result = applyEntityChange(baseWithRouteOnly, source, 'file:server');

    expect(Object.keys(parse(result))).toEqual(['type', 'name', 'meta', 'server', 'routes']);
    expect(result).toBe(stringify(parse(source)));
  });
});
