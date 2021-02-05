import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('migrates old git uris correctly', async () => {
    const oldRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
    });
    const oldRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
    });
    const newRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
      uriHasBeenMigrated: true,
    });
    const newRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
      uriHasBeenMigrated: true,
    });

    await models.gitRepository.migrate(oldRepoWithSuffix);
    await models.gitRepository.migrate(oldRepoWithoutSuffix);
    await models.gitRepository.migrate(newRepoWithSuffix);
    await models.gitRepository.migrate(newRepoWithoutSuffix);

    expect(oldRepoWithSuffix.uri).toBe('https://github.com/foo/bar.git');
    expect(oldRepoWithoutSuffix.uri).toBe('https://github.com/foo/bar.git');
    expect(newRepoWithSuffix.uri).toBe('https://github.com/foo/bar.git');
    expect(newRepoWithoutSuffix.uri).toBe('https://github.com/foo/bar');
  });
});
