import path from 'path';

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
});
