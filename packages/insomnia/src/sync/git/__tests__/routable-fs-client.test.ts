import { afterAll, describe, expect, it, jest } from '@jest/globals';

import { GIT_CLONE_DIR } from '../git-vcs';
import { MemClient } from '../mem-client';
import { routableFSClient } from '../routable-fs-client';

describe('routableFSClient', () => {
  afterAll(() => jest.restoreAllMocks());

  it('routes .git and other files to separate places', async () => {
    const pGit = MemClient.createClient();
    const pDir = MemClient.createClient();
    const fsClient = routableFSClient(pDir, {
      '/.git': pGit,
    }).promises;
    await fsClient.mkdir('/.git');
    await fsClient.mkdir('/other');
    await fsClient.writeFile('/other/a.txt', 'a');
    await fsClient.writeFile('/.git/b.txt', 'b');
    expect(await pGit.promises.readdir('/.git')).toEqual(['b.txt']);
    expect(await pDir.promises.readdir('/other')).toEqual(['a.txt']);
    // Kind of an edge case, but reading the root dir will not list the .git folder
    expect(await pDir.promises.readdir(GIT_CLONE_DIR)).toEqual(['other']);
    expect((await fsClient.readFile('/other/a.txt')).toString()).toBe('a');
    expect((await fsClient.readFile('/.git/b.txt')).toString()).toBe('b');
  });
});
