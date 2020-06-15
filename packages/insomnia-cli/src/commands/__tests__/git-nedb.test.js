import * as gitDb from '../git-nedb';

describe('git-nedb', () => {
  const gitRepoFixturePath = 'src/commands/__fixtures__/git-repo';

  it('can initialize with git-repo fixture directory', async () => {
    await gitDb.init(gitRepoFixturePath);

    expect(await gitDb.all('ApiSpec')).toHaveLength(1);
    expect(await gitDb.all('Environment')).toHaveLength(2);
    expect(await gitDb.all('Request')).toHaveLength(19);
    expect(await gitDb.all('RequestGroup')).toHaveLength(3);
    expect(await gitDb.all('Workspace')).toHaveLength(1);
  });
});
