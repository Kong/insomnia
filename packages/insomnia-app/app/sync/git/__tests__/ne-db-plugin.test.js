// @flow
import YAML from 'yaml';
import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import * as db from '../../../common/database';
import { assertAsyncError, setupDateMocks } from './util';
import NeDBPlugin from '../ne-db-plugin';
import path from 'path';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME } from '../git-vcs';
jest.mock('path');

describe.each(['win32', 'posix'])('NeDBPlugin using path.%s', type => {
  beforeAll(() => path.__mockPath(type));
  afterAll(() => jest.restoreAllMocks());

  beforeEach(async () => {
    await globalBeforeEach();

    setupDateMocks();

    // Create some sample models
    await models.workspace.create({ _id: 'wrk_1' });
    await models.request.create({ _id: 'req_1', parentId: 'wrk_1' });
    await models.request.create({ _id: 'req_2', parentId: 'wrk_1' });

    // Shouldn't list private docs
    await models.request.create({ id: 'req_x', isPrivate: true, parentId: 'wrk_1' });
  });

  describe('readdir()', () => {
    it('reads model IDs from model type folders', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');
      const reqDir = path.join(GIT_INSOMNIA_DIR, models.request.type);
      const wrkDir = path.join(GIT_INSOMNIA_DIR, models.workspace.type);

      expect(await pNeDB.readdir(GIT_CLONE_DIR)).toEqual([GIT_INSOMNIA_DIR_NAME]);
      expect(await pNeDB.readdir(GIT_INSOMNIA_DIR)).toEqual([
        models.apiSpec.type,
        models.environment.type,
        models.request.type,
        models.requestGroup.type,
        models.unitTest.type,
        models.unitTestSuite.type,
        models.workspace.type,
      ]);

      expect(await pNeDB.readdir(reqDir)).toEqual(['req_1.yml', 'req_2.yml']);
      expect(await pNeDB.readdir(wrkDir)).toEqual(['wrk_1.yml']);
    });
  });

  describe('readFile()', () => {
    it('reads file from model/id folders', async () => {
      const wrk1Yml = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_1.yml');
      const req1Yml = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_1.yml');
      const reqXYml = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_x.yml');

      const pNeDB = new NeDBPlugin('wrk_1');

      expect(YAML.parse(await pNeDB.readFile(wrk1Yml, 'utf8'))).toEqual(
        expect.objectContaining({ _id: 'wrk_1', parentId: null }),
      );

      expect(YAML.parse(await pNeDB.readFile(req1Yml, 'utf8'))).toEqual(
        expect.objectContaining({ _id: 'req_1', parentId: 'wrk_1' }),
      );

      await assertAsyncError(pNeDB.readFile(reqXYml));
    });
  });

  describe('stat()', () => {
    it('stats a dir', async () => {
      // Assemble
      const reqDir = path.join(GIT_INSOMNIA_DIR, models.request.type);
      const wrkDir = path.join(GIT_INSOMNIA_DIR, models.workspace.type);

      const dirType = expect.objectContaining({ type: 'dir' });
      const fileType = expect.objectContaining({ type: 'file' });

      // Act
      const pNeDB = new NeDBPlugin('wrk_1');

      // Assert
      expect(await pNeDB.stat(GIT_CLONE_DIR)).toEqual(dirType);
      expect(await pNeDB.stat(GIT_INSOMNIA_DIR)).toEqual(dirType);
      expect(await pNeDB.stat(reqDir)).toEqual(dirType);

      expect(await pNeDB.stat(path.join(wrkDir, 'wrk_1.yml'))).toEqual(fileType);
      expect(await pNeDB.stat(path.join(reqDir, 'req_2.yml'))).toEqual(fileType);
    });
  });

  describe('writeFile()', () => {
    it('should ignore files not in GIT_INSOMNIA_DIR directory', async () => {
      // Assemble
      const upsertSpy = jest.spyOn(db, 'upsert');
      const workspaceId = 'wrk_1';
      const pNeDB = new NeDBPlugin(workspaceId);

      const env = { _id: 'env_1', type: models.environment.type, parentId: workspaceId };
      const filePath = path.join('anotherDir', env.type, `${env._id}.yml`);

      // Act
      await pNeDB.writeFile(filePath, YAML.stringify(env));

      // Assert
      expect(upsertSpy).not.toBeCalled();

      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should write files in GIT_INSOMNIA_DIR directory to db', async () => {
      // Assemble
      const workspaceId = 'wrk_1';
      const pNeDB = new NeDBPlugin(workspaceId);
      const upsertSpy = jest.spyOn(db, 'upsert');

      const env = { _id: 'env_1', type: models.environment.type, parentId: workspaceId };
      const filePath = path.join(GIT_INSOMNIA_DIR, env.type, `${env._id}.yml`);

      // Act
      await pNeDB.writeFile(filePath, YAML.stringify(env));

      // Assert
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(env, true);

      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should throw error if id does not match', async () => {
      // Assemble
      const workspaceId = 'wrk_1';
      const pNeDB = new NeDBPlugin(workspaceId);

      const env = { _id: 'env_1', type: models.environment.type, parentId: workspaceId };
      const filePath = path.join(GIT_INSOMNIA_DIR, env.type, `env_2.yml`);

      // Act
      const promiseResult = pNeDB.writeFile(filePath, YAML.stringify(env));

      // Assert
      await expect(promiseResult).rejects.toThrowError(
        `Doc _id does not match file path [env_1 != env_2]`,
      );
    });

    it('should throw error if type does not match', async () => {
      // Assemble
      const workspaceId = 'wrk_1';
      const pNeDB = new NeDBPlugin(workspaceId);

      const env = { _id: 'env_1', type: models.environment.type, parentId: workspaceId };
      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, `${env._id}.yml`);

      // Act
      const promiseResult = pNeDB.writeFile(filePath, YAML.stringify(env));

      // Assert
      await expect(promiseResult).rejects.toThrowError(
        `Doc type does not match file path [Environment != Request]`,
      );
    });
  });

  describe('mkdir()', () => {
    it('should throw error', async () => {
      const workspaceId = 'wrk_1';
      const pNeDB = new NeDBPlugin(workspaceId);

      const promiseResult = pNeDB.mkdir('', '');

      await expect(promiseResult).rejects.toThrowError('NeDBPlugin is not writable');
    });
  });
});
