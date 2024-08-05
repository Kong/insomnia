import path from 'path';
import { describe, expect, it } from 'vitest';

import neDbAdapter from './ne-db-adapter';

describe('neDbAdapter()', () => {
  const fixturesPath = path.join(__dirname, '../fixtures');

  it('should return null if data directory is invalid', async () => {
    const workingDir = path.join(fixturesPath, 'git-repo');
    const db = await neDbAdapter(workingDir);
    expect(db).toBe(null);
  });
});
