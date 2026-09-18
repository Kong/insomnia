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
  });
});
