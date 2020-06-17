// @flow
import path from 'path';
import { gitDataDirDb } from '../mem-db';

describe('mem-db', () => {
  describe('seedGitDataDir()', () => {
    const fixturesPath = 'src/db/__fixtures__';

    it('should seed with git-repo directory', async () => {
      const dir = path.join(fixturesPath, 'git-repo');
      const db = await gitDataDirDb(dir);

      expect(db.ApiSpec.size).toBe(1);
      expect(db.Environment.size).toBe(2);
      expect(db.Request.size).toBe(2);
      expect(db.RequestGroup.size).toBe(1);
      expect(db.Workspace.size).toBe(1);
    });

    it('should safely continue if data directory not found', async () => {
      const dir = path.join(fixturesPath, 'git-repo-without-insomnia');
      const db = await gitDataDirDb(dir);
      expect(db.ApiSpec.size).toBe(0);
    });

    it('should ignore unexpected type directories', async () => {
      const dir = path.join(fixturesPath, 'git-repo-malformed-insomnia');
      const db = await gitDataDirDb(dir);

      expect(db.Workspace.size).toBe(1);
    });
  });
});
