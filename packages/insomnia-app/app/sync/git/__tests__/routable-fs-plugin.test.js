import { MemPlugin } from '../mem-plugin';
import { routableFSPlugin } from '../routable-fs-plugin';
import { GIT_CLONE_DIR } from '../git-vcs';
import path from 'path';
jest.mock('path');

describe.each(['win32', 'posix'])('routableFSPlugin using path.%s', type => {
  beforeAll(() => path.__mockPath(type));
  afterAll(() => jest.restoreAllMocks());
  it('routes .git and other files to separate places', async () => {
    const pGit = MemPlugin.createPlugin();
    const pDir = MemPlugin.createPlugin();

    const p = routableFSPlugin(pDir, { '/.git': pGit }).promises;

    await p.mkdir('/.git');
    await p.mkdir('/other');

    await p.writeFile('/other/a.txt', 'a');
    await p.writeFile('/.git/b.txt', 'b');

    expect(await pGit.promises.readdir('/.git')).toEqual(['b.txt']);
    expect(await pDir.promises.readdir('/other')).toEqual(['a.txt']);

    // Kind of an edge case, but reading the root dir will not list the .git folder
    expect(await pDir.promises.readdir(GIT_CLONE_DIR)).toEqual(['other']);

    expect((await p.readFile('/other/a.txt')).toString()).toBe('a');
    expect((await p.readFile('/.git/b.txt')).toString()).toBe('b');
  });
});
