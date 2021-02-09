import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('migrates old git uris correctly', async () => {
    const oldRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
      uriHasBeenMigrated: false,
    });
    const oldRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
      uriHasBeenMigrated: false,
    });
    const newRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
    });
    const newRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
    });

    await models.gitRepository.migrate(oldRepoWithSuffix);
    await models.gitRepository.migrate(oldRepoWithoutSuffix);
    await models.gitRepository.migrate(newRepoWithSuffix);
    await models.gitRepository.migrate(newRepoWithoutSuffix);

    expect(oldRepoWithSuffix).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriHasBeenMigrated: true,
      }),
    );
    expect(oldRepoWithoutSuffix).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriHasBeenMigrated: true,
      }),
    );
    expect(newRepoWithSuffix).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriHasBeenMigrated: true,
      }),
    );
    expect(newRepoWithoutSuffix).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar',
        uriHasBeenMigrated: true,
      }),
    );
  });
});
