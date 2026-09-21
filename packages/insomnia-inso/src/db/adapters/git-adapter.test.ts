import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import gitAdapter from './git-adapter';

describe('gitAdapter()', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');

  it('should seed with git-repo directory', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await gitAdapter(workingDir);
    expect(db?.ApiSpec.length).toBe(1);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(2);
    expect(db?.RequestGroup.length).toBe(1);
    expect(db?.Workspace.length).toBe(1);
    expect(db?.UnitTestSuite.length).toBe(2);
    expect(db?.UnitTest.length).toBe(4);
  });

  it('should seed with git-repo directory with filter', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await gitAdapter(workingDir, ['Environment']);
    expect(db?.ApiSpec.length).toBe(0);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(0);
    expect(db?.RequestGroup.length).toBe(0);
    expect(db?.Workspace.length).toBe(0);
    expect(db?.UnitTestSuite.length).toBe(0);
    expect(db?.UnitTest.length).toBe(0);
  });

  it('should return null if data directory is invalid', async () => {
    const workingDir = path.join(fixturesPath, 'nedb');
    const db = await gitAdapter(workingDir);
    expect(db).toBe(null);
  });

  describe('type restriction', () => {
    let workingDir: string;

    afterEach(() => {
      if (workingDir) {
        fs.rmSync(workingDir, { recursive: true, force: true });
      }
    });

    it('does not read a Settings folder, since Settings.canSync is false', async () => {
      // gitAdapter() only reads folders for types where models.canSync() is
      // true, so a 'Settings' folder is never opened even when it sits
      // alongside a normal Workspace folder with well-formed content.
      workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-adapter-'));
      const insomniaDir = path.join(workingDir, '.insomnia');

      fs.mkdirSync(path.join(insomniaDir, 'Workspace'), { recursive: true });
      fs.writeFileSync(
        path.join(insomniaDir, 'Workspace', 'wrk_new.yml'),
        YAML.stringify({
          _id: 'wrk_new',
          type: 'Workspace',
          name: 'New workspace',
          parentId: null,
          scope: 'collection',
        }),
      );

      fs.mkdirSync(path.join(insomniaDir, 'Settings'), { recursive: true });
      const settingsData = {
        _id: 'set_new',
        type: 'Settings',
        validateSSL: false,
        proxyEnabled: true,
        httpProxy: 'http://example.com:8080',
        httpsProxy: 'http://example.com:8080',
      };
      fs.writeFileSync(
        path.join(insomniaDir, 'Settings', 'set_new.yml'),
        YAML.stringify(settingsData),
      );

      const db = await gitAdapter(workingDir);

      expect(db?.Settings).toHaveLength(0);
      expect(db?.Workspace).toHaveLength(1);
    });

    // gitAdapter() only ever reads folders named after one of the Database
    // keys (see packages/insomnia-inso/src/db/types.ts), so this is the full
    // set of syncable types reachable through the inso CLI import path today.
    const syncableTypes = ['ApiSpec', 'Environment', 'Request', 'RequestGroup', 'Workspace', 'UnitTestSuite', 'UnitTest'] as const;
    // Non-syncable Database keys: these folders exist in legacy .insomnia
    // directories but must never be merged in, since canSync is false.
    const nonSyncableTypes = ['WorkspaceMeta', 'ClientCertificate', 'CaCertificate', 'CookieJar', 'CloudCredential', 'Settings'] as const;

    const writeMinimalDoc = (insomniaDir: string, type: string) => {
      const typeDir = path.join(insomniaDir, type);
      fs.mkdirSync(typeDir, { recursive: true });
      const doc = { _id: `${type.toLowerCase()}_new`, type, name: `New ${type}`, parentId: null };
      fs.writeFileSync(path.join(typeDir, `${doc._id}.yml`), YAML.stringify(doc));
    };

    it.each(syncableTypes)('reads a %s folder, since canSync is true', async type => {
      workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-adapter-'));
      const insomniaDir = path.join(workingDir, '.insomnia');
      writeMinimalDoc(insomniaDir, type);

      const db = await gitAdapter(workingDir);

      expect(db?.[type as keyof typeof db]).toHaveLength(1);
    });

    it.each(nonSyncableTypes)('does not read a %s folder, since canSync is false', async type => {
      workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-adapter-'));
      const insomniaDir = path.join(workingDir, '.insomnia');
      writeMinimalDoc(insomniaDir, type);
      // Include a syncable folder alongside it so we confirm the whole read didn't just fail
      writeMinimalDoc(insomniaDir, 'Workspace');

      const db = await gitAdapter(workingDir);

      expect(db?.[type as keyof typeof db]).toHaveLength(0);
      expect(db?.Workspace).toHaveLength(1);
    });
  });
});
