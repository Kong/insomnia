import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { database as db } from '~/common/database';
import { fsClient } from '~/sync/git/fs-client';

vi.mock('~/main/analytics', async () => {
  const { AnalyticsEvent } = await import('insomnia-analytics');
  return {
    AnalyticsEvent,
    trackAnalyticsEvent: vi.fn(),
    setCurrentOrganizationId: vi.fn(),
    trackPageView: vi.fn(),
  };
});

const { importLegacyInsomniaFolder } = await import('~/main/git-service');

describe('importLegacyInsomniaFolder() doc id validation', () => {
  let repoDir: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-legacy-validation-'));
  });

  afterEach(async () => {
    await fs.promises.rm(repoDir, { recursive: true, force: true });
  });

  // The file name is independent from the `_id` inside the file, which is attacker controlled.
  const writeRaw = (type: string, fileName: string, doc: Record<string, unknown>) => {
    const typeDir = path.join(repoDir, '.insomnia', type);
    fs.mkdirSync(typeDir, { recursive: true });
    fs.writeFileSync(path.join(typeDir, fileName), YAML.stringify({ type, ...doc }));
  };

  it('refuses a workspace whose _id passes the file path substring check but is not a safe segment', async () => {
    // '.insomnia/Workspace/wrk_x.yaml' includes 'Workspace/wrk_x', so the old check let this through
    writeRaw('Workspace', 'wrk_x.yaml', { _id: 'Workspace/wrk_x', name: 'evil', scope: 'collection' });

    const result = await importLegacyInsomniaFolder({ fsClient: fsClient(repoDir), projectId: 'proj_test' });

    expect(result.errors?.[0]).toMatch(/unsafe _id/);
    expect(await db.findOne('Workspace', { _id: 'Workspace/wrk_x' })).toBeUndefined();
    expect(await services.workspaceMeta.getByParentId('Workspace/wrk_x')).toBeUndefined();
    expect(result.changes).toBeUndefined();
  });

  it('refuses an empty _id, which is a substring of every file path', async () => {
    writeRaw('Request', 'req_x.yaml', { _id: '', parentId: 'wrk_a' });
    const result = await importLegacyInsomniaFolder({ fsClient: fsClient(repoDir), projectId: 'proj_test' });
    expect(result.errors?.[0]).toMatch(/unsafe _id/);
  });

  it('refuses a doc with an unsafe parentId', async () => {
    writeRaw('Request', 'req_x.yaml', { _id: 'req_x', parentId: '../../etc' });
    const result = await importLegacyInsomniaFolder({ fsClient: fsClient(repoDir), projectId: 'proj_test' });
    expect(result.errors?.[0]).toMatch(/unsafe parentId/);
    expect(await db.findOne('Request', { _id: 'req_x' })).toBeUndefined();
  });

  it('applies nothing when a later doc is hostile (all-or-nothing)', async () => {
    writeRaw('Request', 'req_a.yaml', { _id: 'req_a', parentId: 'wrk_a', name: 'benign' });
    writeRaw('Workspace', 'wrk_a.yaml', { _id: 'wrk_a', name: 'benign', scope: 'collection' });
    writeRaw('Workspace', 'wrk_z.yaml', { _id: 'Workspace/wrk_z', name: 'evil', scope: 'collection' });

    const result = await importLegacyInsomniaFolder({ fsClient: fsClient(repoDir), projectId: 'proj_test' });

    expect(result.errors).toBeDefined();
    expect(await db.findOne('Request', { _id: 'req_a' })).toBeUndefined();
    expect(await db.findOne('Workspace', { _id: 'wrk_a' })).toBeUndefined();
    expect(await services.workspaceMeta.getByParentId('wrk_a')).toBeUndefined();
    expect(fs.existsSync(path.join(repoDir, '.insomnia'))).toBe(true);
  });

  it('applies nothing when a later file has a merge conflict', async () => {
    writeRaw('Request', 'req_a.yaml', { _id: 'req_a', parentId: 'wrk_a' });
    const dir = path.join(repoDir, '.insomnia', 'Workspace');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'wrk_a.yaml'), 'a: 1\n=======\nb: 2\n');

    const result = await importLegacyInsomniaFolder({ fsClient: fsClient(repoDir), projectId: 'proj_test' });

    expect(result.errors?.[0]).toMatch(/merge conflict/);
    expect(await db.findOne('Request', { _id: 'req_a' })).toBeUndefined();
  });
});
