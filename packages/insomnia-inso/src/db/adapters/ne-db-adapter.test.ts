import path from 'node:path';

import { describe, expect, it } from 'vitest';

import neDbAdapter from './ne-db-adapter';

describe('neDbAdapter()', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');

  it('should return null if data directory is invalid', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await neDbAdapter(workingDir);
    expect(db).toBe(null);
  });

  it('should load all types from a real nedb data directory', async () => {
    const workingDir = path.join(fixturesPath, 'nedb');
    const db = await neDbAdapter(workingDir);
    expect(db).not.toBeNull();
    expect(db!.Workspace).toHaveLength(2);
    expect(db!.Workspace.map(w => w.name).sort()).toEqual(['Insomnia Designer', 'Sample Spec 1.2']);
    expect(db!.ApiSpec).toHaveLength(2);
    expect(db!.ApiSpec.map(s => s.fileName).sort()).toEqual(['Insomnia Designer', 'Sample Specification']);
  });

  it('should only load the requested types when filterTypes is given', async () => {
    const workingDir = path.join(fixturesPath, 'nedb');
    const db = await neDbAdapter(workingDir, ['ApiSpec']);
    expect(db).not.toBeNull();
    expect(db!.ApiSpec).toHaveLength(2);
    expect(db!.Workspace).toHaveLength(0);
  });
});
