import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { models } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { database as db } from '~/common/database';
import { fsClient } from '~/sync/git/fs-client';

// git-service.ts pulls in main/analytics.ts, which pulls in @sentry/electron
// and other Electron-main-process-only globals that aren't relevant to the
// legacy-migration logic under test here (and don't play well with the
// project's lightweight `electron` test mock). Replace it with a no-op that
// keeps the real, dependency-free `AnalyticsEvent` enum intact.
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

const PROJECT_ID = 'proj_test';

describe('importLegacyInsomniaFolder()', () => {
  let repoDir: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-legacy-migration-'));
  });

  afterEach(async () => {
    await fs.promises.rm(repoDir, { recursive: true, force: true });
  });

  const writeLegacyDoc = (type: string, doc: Record<string, unknown>) => {
    const typeDir = path.join(repoDir, '.insomnia', type);
    fs.mkdirSync(typeDir, { recursive: true });
    fs.writeFileSync(path.join(typeDir, `${doc._id}.yaml`), YAML.stringify({ type, ...doc }));
  };

  it('does not migrate anything when there is no legacy .insomnia folder', async () => {
    const client = fsClient(repoDir);
    const result = await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });
    expect(result.changes).toBeUndefined();
  });

  describe('syncable types', () => {
    // The full set of model types where canSync is true today. Each should be
    // migrated into the database from a legacy .insomnia/<Type>/ folder.
    const syncableTypes = models
      .all()
      .filter(m => m.canSync)
      .map(m => m.type)
      .sort();

    it('documents the exact set of types allowed to migrate', () => {
      expect(syncableTypes).toEqual(
        [
          'ApiSpec',
          'Environment',
          'GrpcRequest',
          'MockRoute',
          'MockServer',
          'McpRequest',
          'ProjectLintRuleset',
          'ProtoDirectory',
          'ProtoFile',
          'Request',
          'RequestGroup',
          'SocketIOPayload',
          'SocketIORequest',
          'UnitTest',
          'UnitTestSuite',
          'WebSocketPayload',
          'WebSocketRequest',
          'Workspace',
        ].sort(),
      );
    });

    it.each(syncableTypes)('migrates a %s document into the database, since canSync is true', async type => {
      // Workspace is required for the fixture's Workspace-scoped types, but it
      // also independently exercises the parentId-correction path below, so
      // give every case a Workspace folder regardless of the type under test.
      writeLegacyDoc(models.workspace.type, { _id: 'wrk_test', name: 'Test Workspace', scope: 'collection', parentId: null });

      const docId = `${type}_new`;
      writeLegacyDoc(type, { _id: docId, name: `New ${type}`, parentId: 'wrk_test' });

      const client = fsClient(repoDir);
      const result = await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });

      expect(result.errors).toBeUndefined();

      const doc = await db.findOne(type, { _id: docId });
      expect(doc).toBeDefined();
      expect(doc?.type).toBe(type);
    });
  });

  describe('non-syncable types', () => {
    // The full set of model types where canSync is false. None of these
    // should ever be written to the database by the legacy migration, even
    // though their directory/id/type fields are all well-formed. This is the
    // regression coverage for the Settings-smuggling vulnerability: an
    // attacker-authored repo ships a `.insomnia/Settings/` folder containing
    // a full Settings document (e.g. a malicious httpProxy + validateSSL:
    // false), which getOrCreate()'s created-ascending sort would then prefer
    // over the genuine record.
    const nonSyncableTypes = models
      .all()
      .filter(m => !m.canSync)
      .map(m => m.type)
      .sort();

    it.each(nonSyncableTypes)('does not migrate a %s document into the database, since canSync is false', async type => {
      writeLegacyDoc(models.workspace.type, { _id: 'wrk_test', name: 'Test Workspace', scope: 'collection', parentId: null });

      const docId = `${type}_new`;
      writeLegacyDoc(type, { _id: docId, name: `New ${type}` });

      const client = fsClient(repoDir);
      const result = await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });

      expect(result.errors).toBeUndefined();

      const doc = await db.findOne(type, { _id: docId });
      expect(doc).toBeUndefined();
    });

    it('specifically blocks a smuggled Settings document from overriding the real settings', async () => {
      writeLegacyDoc(models.workspace.type, { _id: 'wrk_test', name: 'Test Workspace', scope: 'collection', parentId: null });

      writeLegacyDoc(models.settings.type, {
        _id: 'set_attacker',
        created: 0,
        proxyEnabled: true,
        httpProxy: 'http://attacker.example.com:8080',
        httpsProxy: 'http://attacker.example.com:8080',
        validateSSL: false,
      });

      const client = fsClient(repoDir);
      const result = await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });

      expect(result.errors).toBeUndefined();

      const attackerSettings = await db.findOne(models.settings.type, { _id: 'set_attacker' });
      expect(attackerSettings).toBeUndefined();
    });

    it('still migrates the syncable Workspace alongside a rejected Settings folder', async () => {
      writeLegacyDoc(models.workspace.type, { _id: 'wrk_test', name: 'Test Workspace', scope: 'collection', parentId: null });
      writeLegacyDoc(models.settings.type, {
        _id: 'set_attacker',
        created: 0,
        proxyEnabled: true,
      });

      const client = fsClient(repoDir);
      const result = await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });

      expect(result.errors).toBeUndefined();

      const workspace = await db.findOne(models.workspace.type, { _id: 'wrk_test' });
      expect(workspace).toBeDefined();
      expect((workspace as { parentId?: string })?.parentId).toBe(PROJECT_ID);

      const attackerSettings = await db.findOne(models.settings.type, { _id: 'set_attacker' });
      expect(attackerSettings).toBeUndefined();
    });
  });

  it('removes the legacy .insomnia folder from disk after migrating', async () => {
    writeLegacyDoc(models.workspace.type, { _id: 'wrk_test', name: 'Test Workspace', scope: 'collection', parentId: null });

    const client = fsClient(repoDir);
    await importLegacyInsomniaFolder({ fsClient: client, projectId: PROJECT_ID });

    const legacyDirExists = fs.existsSync(path.join(repoDir, '.insomnia'));
    expect(legacyDirExists).toBe(false);
  });
});
