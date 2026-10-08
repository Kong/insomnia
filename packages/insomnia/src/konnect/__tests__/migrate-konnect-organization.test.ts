/**
 * Tests run against the in-memory NeDB initialized by setup-vitest.ts.
 * localStorage is stubbed per-test to supply the cached organization list.
 */

import { initDatabase, models, services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mainDatabase } from '../../main/database.main';
import {
  detectKonnectOrgMigration,
  migrateKonnectProjectsIfUnambiguous,
  runKonnectOrgMigration,
} from '../migrate-konnect-organization';

const ACCOUNT_ID = 'acct_1';
const ORG_A = 'org_a';
const ORG_B = 'org_b';
const KONNECT_ORG_ID = models.organization.getKonnectOrganizationId(ACCOUNT_ID);

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

async function createKonnectProject(parentId: string, controlPlaneId: string) {
  const project = await services.project.create({
    name: `CP ${controlPlaneId}`,
    parentId,
    konnectControlPlaneId: controlPlaneId,
  });
  await services.workspace.create({
    name: `Service of ${controlPlaneId}`,
    parentId: project._id,
    scope: 'collection',
    konnectServiceId: `svc-${controlPlaneId}`,
  });
  return project;
}

const listKonnectProjects = () => services.project.list({ konnectControlPlaneId: { $exists: true, $ne: null } });

beforeEach(async () => {
  await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
  stubLocalStorage({
    [`${ACCOUNT_ID}:spaces`]: JSON.stringify([
      { id: ORG_A, name: 'Org A' },
      { id: ORG_B, name: 'Org B' },
    ]),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectKonnectOrgMigration', () => {
  it('reports nothing to do when there are no Konnect projects', async () => {
    expect(await detectKonnectOrgMigration({ accountId: ACCOUNT_ID })).toEqual({ status: 'none', groups: [] });
  });

  it('reports a single source organization as auto-migratable', async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    await createKonnectProject(ORG_A, 'cp-2');

    const plan = await detectKonnectOrgMigration({ accountId: ACCOUNT_ID });

    expect(plan.status).toBe('auto');
    expect(plan.groups).toEqual([
      { organizationId: ORG_A, organizationName: 'Org A', projectCount: 2, workspaceCount: 2 },
    ]);
  });

  it('reports multiple source organizations as a conflict', async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    await createKonnectProject(ORG_B, 'cp-2');

    const plan = await detectKonnectOrgMigration({ accountId: ACCOUNT_ID });

    expect(plan.status).toBe('conflict');
    expect(plan.groups.map(g => g.organizationId).sort()).toEqual([ORG_A, ORG_B]);
  });

  it('ignores Konnect projects owned by another account on the same machine', async () => {
    await createKonnectProject('org_someone_else', 'cp-1');

    expect(await detectKonnectOrgMigration({ accountId: ACCOUNT_ID })).toEqual({ status: 'none', groups: [] });
  });

  it('ignores Konnect projects that already live under the Konnect organization', async () => {
    await createKonnectProject(KONNECT_ORG_ID, 'cp-1');

    expect(await detectKonnectOrgMigration({ accountId: ACCOUNT_ID })).toEqual({ status: 'none', groups: [] });
  });

  it('ignores regular projects, which omit konnectControlPlaneId entirely', async () => {
    await services.project.create({ name: 'Regular', parentId: ORG_A });

    expect(await detectKonnectOrgMigration({ accountId: ACCOUNT_ID })).toEqual({ status: 'none', groups: [] });
  });
});

describe('runKonnectOrgMigration', () => {
  it('re-parents the chosen organization and deletes the rest with their descendants', async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    const discarded = await createKonnectProject(ORG_B, 'cp-2');

    await runKonnectOrgMigration({ accountId: ACCOUNT_ID, keepOrganizationId: ORG_A });

    const projects = await listKonnectProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].parentId).toBe(KONNECT_ORG_ID);
    expect(projects[0].konnectControlPlaneId).toBe('cp-1');

    expect(await services.workspace.count({ parentId: discarded._id })).toBe(0);
  });

  it("leaves another account's Konnect projects untouched", async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    await createKonnectProject('org_someone_else', 'cp-other');

    await runKonnectOrgMigration({ accountId: ACCOUNT_ID, keepOrganizationId: ORG_A });

    const projects = await listKonnectProjects();
    expect(projects.map(p => p.parentId).sort()).toEqual([KONNECT_ORG_ID, 'org_someone_else'].sort());
  });

  it('carries the last-synced timestamp over to the Konnect organization', async () => {
    const store = stubLocalStorage({
      [`${ACCOUNT_ID}:spaces`]: JSON.stringify([{ id: ORG_A, name: 'Org A' }]),
      [`${ORG_A}:konnect-last-synced-at`]: '1700000000000',
    });
    await createKonnectProject(ORG_A, 'cp-1');

    await runKonnectOrgMigration({ accountId: ACCOUNT_ID, keepOrganizationId: ORG_A });

    expect(store.get(`${KONNECT_ORG_ID}:konnect-last-synced-at`)).toBe('1700000000000');
    expect(store.get(`${ORG_A}:konnect-last-synced-at`)).toBeUndefined();
  });

  it('clears the last-synced timestamp of every source organization but leaves orphans alone', async () => {
    const store = stubLocalStorage({
      [`${ACCOUNT_ID}:spaces`]: JSON.stringify([
        { id: ORG_A, name: 'Org A' },
        { id: ORG_B, name: 'Org B' },
      ]),
      [`${ORG_A}:konnect-last-synced-at`]: '1700000000000',
      [`${ORG_B}:konnect-last-synced-at`]: '1600000000000',
      ['org_someone_else:konnect-last-synced-at']: '1500000000000',
    });
    await createKonnectProject(ORG_A, 'cp-1');
    await createKonnectProject(ORG_B, 'cp-2');
    await createKonnectProject('org_someone_else', 'cp-other');

    await runKonnectOrgMigration({ accountId: ACCOUNT_ID, keepOrganizationId: ORG_A });

    expect(store.get(`${KONNECT_ORG_ID}:konnect-last-synced-at`)).toBe('1700000000000');
    expect(store.get(`${ORG_A}:konnect-last-synced-at`)).toBeUndefined();
    expect(store.get(`${ORG_B}:konnect-last-synced-at`)).toBeUndefined();
    expect(store.get('org_someone_else:konnect-last-synced-at')).toBe('1500000000000');
  });

  it('neither re-parents nor deletes regular projects', async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    const keptRegular = await services.project.create({ name: 'Regular A', parentId: ORG_A });
    const discardedRegular = await services.project.create({ name: 'Regular B', parentId: ORG_B });

    await runKonnectOrgMigration({ accountId: ACCOUNT_ID, keepOrganizationId: ORG_A });

    expect((await services.project.getById(keptRegular._id))?.parentId).toBe(ORG_A);
    expect((await services.project.getById(discardedRegular._id))?.parentId).toBe(ORG_B);
  });
});

describe('migrateKonnectProjectsIfUnambiguous', () => {
  it('migrates automatically and is idempotent on a second run', async () => {
    await createKonnectProject(ORG_A, 'cp-1');

    expect(await migrateKonnectProjectsIfUnambiguous(ACCOUNT_ID)).toEqual({ status: 'none', groups: [] });

    const afterFirstRun = await listKonnectProjects();
    expect(afterFirstRun.map(p => p.parentId)).toEqual([KONNECT_ORG_ID]);

    expect(await migrateKonnectProjectsIfUnambiguous(ACCOUNT_ID)).toEqual({ status: 'none', groups: [] });
    expect(await listKonnectProjects()).toHaveLength(1);
  });

  it('defers to the user when the source organization is ambiguous', async () => {
    await createKonnectProject(ORG_A, 'cp-1');
    await createKonnectProject(ORG_B, 'cp-2');

    const plan = await migrateKonnectProjectsIfUnambiguous(ACCOUNT_ID);

    expect(plan.status).toBe('conflict');
    // Nothing moved until the user picks one.
    const projects = await listKonnectProjects();
    expect(projects.map(p => p.parentId).sort()).toEqual([ORG_A, ORG_B]);
  });
});
