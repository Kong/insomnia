import path from 'node:path';

import { models } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { database as db } from '../../../common/database';
import { GIT_INSOMNIA_DIR } from '../git-vcs';
import { NeDBClient } from '../ne-db-client';

describe('NeDBClient.writeFile() doc validation', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  const write = (fileId: string, doc: Record<string, unknown>) =>
    new NeDBClient('wrk_test', 'proj_test').writeFile(
      path.join(GIT_INSOMNIA_DIR, models.request.type, `${fileId}.yml`),
      YAML.stringify({ type: models.request.type, name: 'r', url: 'http://example.com', ...doc }),
    );

  it('writes a doc with well-formed ids', async () => {
    await write('req_ok', { _id: 'req_ok', parentId: 'wrk_test' });
    expect(await db.findOne(models.request.type, { _id: 'req_ok' })).toBeTruthy();
  });

  it('refuses a doc whose _id matches its file name but is not a safe segment', async () => {
    // a backslash is a legal file name character on POSIX and a separator on Windows
    await expect(write('req_..\\..\\x', { _id: 'req_..\\..\\x', parentId: 'wrk_test' })).rejects.toThrow(/unsafe _id/);
    expect(await db.findOne(models.request.type, { _id: 'req_..\\..\\x' })).toBeFalsy();
  });

  it('refuses a doc with an unsafe parentId', async () => {
    await expect(write('req_evil', { _id: 'req_evil', parentId: '../../x' })).rejects.toThrow(/unsafe parentId/);
    expect(await db.findOne(models.request.type, { _id: 'req_evil' })).toBeFalsy();
  });
});
