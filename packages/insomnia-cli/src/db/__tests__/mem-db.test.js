// @flow
import path from 'path';
import * as db from '../mem-db';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('mem-db', () => {
  beforeEach(globalBeforeEach);

  describe('seedGitDataDir()', () => {
    const fixturesPath = 'src/db/__fixtures__';

    it('should seed with git-repo directory', async () => {
      const dir = path.join(fixturesPath, 'git-repo');
      await db.seedGitDataDir(dir);

      expect(await db.all('ApiSpec')).toHaveLength(1);
      expect(await db.all('Environment')).toHaveLength(2);
      expect(await db.all('Request')).toHaveLength(2);
      expect(await db.all('RequestGroup')).toHaveLength(1);
      expect(await db.all('Workspace')).toHaveLength(1);
    });

    it('should safely continue if data directory not found', async () => {
      const dir = path.join(fixturesPath, 'git-repo-without-insomnia');
      await db.seedGitDataDir(dir);
      expect(await db.all('Workspace')).toHaveLength(0);
    });

    it('should ignore unexpected type directories', async () => {
      const dir = path.join(fixturesPath, 'git-repo-malformed-insomnia');
      await db.seedGitDataDir(dir);

      expect(await db.all('Workspace')).toHaveLength(1);
    });
  });
});
