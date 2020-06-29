// @flow
import path from 'path';
import gitAdapter from '../git-adapter';

describe('gitAdapter()', () => {
  const fixturesPath = 'src/db/__fixtures__';

  it('should seed with git-repo directory', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await gitAdapter(workingDir);

    expect(db?.ApiSpec.length).toBe(1);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(2);
    expect(db?.RequestGroup.length).toBe(1);
    expect(db?.Workspace.length).toBe(1);
  });

  it('should seed with git-repo directory with filter', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await gitAdapter(workingDir, ['Environment']);

    expect(db?.ApiSpec.length).toBe(0);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(0);
    expect(db?.RequestGroup.length).toBe(0);
    expect(db?.Workspace.length).toBe(0);
  });

  it('should return null if data directory not found', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo-without-insomnia');
    const db = await gitAdapter(workingDir);
    expect(db).toBe(null);
  });

  it('should ignore unexpected type directories', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo-malformed-insomnia');
    const db = await gitAdapter(workingDir);

    expect(db?.Workspace.length).toBe(1);
  });
});
