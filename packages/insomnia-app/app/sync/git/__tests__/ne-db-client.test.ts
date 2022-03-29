import { createBuilder } from '@develohpanda/fluent-builder';
import path from 'path';
import YAML from 'yaml';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { DEFAULT_PROJECT_ID } from '../../../models/project';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME } from '../git-vcs';
import { NeDBClient } from '../ne-db-client';
import { assertAsyncError, setupDateMocks } from './util';

const workspaceBuilder = createBuilder(workspaceModelSchema);

describe('NeDBClient', () => {
  afterAll(() => jest.restoreAllMocks());
  beforeEach(async () => {
    await globalBeforeEach();
    workspaceBuilder.reset();
    setupDateMocks();
    // Create some sample models
    await models.project.all();
    await models.workspace.create({
      _id: 'wrk_1',
    });
    await models.request.create({
      _id: 'req_1',
      parentId: 'wrk_1',
    });
    await models.request.create({
      _id: 'req_2',
      parentId: 'wrk_1',
    });
    // Shouldn't list private docs
    await models.request.create({
      _id: 'req_x',
      isPrivate: true,
      parentId: 'wrk_1',
    });
  });

  describe('readdir()', () => {
    it('reads model IDs from model type folders', async () => {
      const neDbClient = new NeDBClient('wrk_1', DEFAULT_PROJECT_ID);
      const reqDir = path.join(GIT_INSOMNIA_DIR, models.request.type);
      const wrkDir = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
      expect(await neDbClient.readdir(GIT_CLONE_DIR)).toEqual([GIT_INSOMNIA_DIR_NAME]);
      expect(await neDbClient.readdir(GIT_INSOMNIA_DIR)).toEqual([
        models.apiSpec.type,
        models.environment.type,
        models.grpcRequest.type,
        models.protoDirectory.type,
        models.protoFile.type,
        models.request.type,
        models.requestGroup.type,
        models.unitTest.type,
        models.unitTestSuite.type,
        models.workspace.type,
      ]);
      expect(await neDbClient.readdir(reqDir)).toEqual(['req_1.yml', 'req_2.yml']);
      expect(await neDbClient.readdir(wrkDir)).toEqual(['wrk_1.yml']);
    });
  });

  describe('readFile()', () => {
    it('reads file from model/id folders', async () => {
      const wrk1Yml = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_1.yml');
      const req1Yml = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_1.yml');
      const reqXYml = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_x.yml');
      const pNeDB = new NeDBClient('wrk_1', DEFAULT_PROJECT_ID);
      expect(YAML.parse((await pNeDB.readFile(wrk1Yml, 'utf8')).toString())).toEqual(
        expect.objectContaining({
          _id: 'wrk_1',
          parentId: null, // should be reset to default value instead of the active project id
        }),
      );
      expect(YAML.parse((await pNeDB.readFile(req1Yml, 'utf8')).toString())).toEqual(
        expect.objectContaining({
          _id: 'req_1',
          parentId: 'wrk_1',
        }),
      );
      await assertAsyncError(pNeDB.readFile(reqXYml));
    });
  });

  describe('stat()', () => {
    it('stats a dir', async () => {
      // Arrange
      const reqDir = path.join(GIT_INSOMNIA_DIR, models.request.type);
      const wrkDir = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
      const dirType = expect.objectContaining({
        type: 'dir',
      });
      const fileType = expect.objectContaining({
        type: 'file',
      });
      // Act
      const neDbClient = new NeDBClient('wrk_1', DEFAULT_PROJECT_ID);
      // Assert
      expect(await neDbClient.stat(GIT_CLONE_DIR)).toEqual(dirType);
      expect(await neDbClient.stat(GIT_INSOMNIA_DIR)).toEqual(dirType);
      expect(await neDbClient.stat(reqDir)).toEqual(dirType);
      expect(await neDbClient.stat(path.join(wrkDir, 'wrk_1.yml'))).toEqual(fileType);
      expect(await neDbClient.stat(path.join(reqDir, 'req_2.yml'))).toEqual(fileType);
    });
  });

  describe('writeFile()', () => {
    it('should ignore files not in GIT_INSOMNIA_DIR directory', async () => {
      // Arrange
      const upsertSpy = jest.spyOn(db, 'upsert');
      const workspaceId = 'wrk_1';
      const neDbClient = new NeDBClient(workspaceId, DEFAULT_PROJECT_ID);
      const env = {
        _id: 'env_1',
        type: models.environment.type,
        parentId: workspaceId,
      };
      const filePath = path.join('anotherDir', env.type, `${env._id}.yml`);
      // Act
      await neDbClient.writeFile(filePath, YAML.stringify(env));
      // Assert
      expect(upsertSpy).not.toBeCalled();
      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should write files in GIT_INSOMNIA_DIR directory to db', async () => {
      // Arrange
      const workspaceId = 'wrk_1';
      const neDbClient = new NeDBClient(workspaceId, DEFAULT_PROJECT_ID);
      const upsertSpy = jest.spyOn(db, 'upsert');
      const env = {
        _id: 'env_1',
        type: models.environment.type,
        parentId: workspaceId,
      };
      const filePath = path.join(GIT_INSOMNIA_DIR, env.type, `${env._id}.yml`);
      // Act
      await neDbClient.writeFile(filePath, YAML.stringify(env));
      // Assert
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(env, true);
      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should set workspace parentId to the project', async () => {
      // Arrange
      const workspaceId = 'wrk_1';
      const projectId = `${models.project.prefix}_1`;
      const neDbClient = new NeDBClient(workspaceId, projectId);
      const upsertSpy = jest.spyOn(db, 'upsert');

      // @ts-expect-error not sure why scope is being typed as never
      workspaceBuilder._id(workspaceId).scope('design').certificates(null);

      // @ts-expect-error parentId can be string or null for a workspace
      const workspaceInFile = workspaceBuilder.parentId(null).build();
      const workspaceInDb = workspaceBuilder.parentId(projectId).build();

      const filePath = path.join(GIT_INSOMNIA_DIR, models.workspace.type, `${workspaceId}.yml`);

      // Act
      await neDbClient.writeFile(filePath, YAML.stringify(workspaceInFile));

      // Assert
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(workspaceInDb, true);

      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should force to a design workspace when writing', async () => {
      // Arrange
      const workspaceId = 'wrk_1';
      const projectId = `${models.project.prefix}_1`;
      const neDbClient = new NeDBClient(workspaceId, projectId);
      const upsertSpy = jest.spyOn(db, 'upsert');

      workspaceBuilder._id(workspaceId).parentId(projectId).certificates(null);

      // @ts-expect-error not sure why scope is being typed as never
      const workspaceInFile = workspaceBuilder.scope('collection').build();
      // @ts-expect-error not sure why scope is being typed as never
      const workspaceInDb = workspaceBuilder.scope('design').build();

      const filePath = path.join(GIT_INSOMNIA_DIR, models.workspace.type, `${workspaceId}.yml`);

      // Act
      await neDbClient.writeFile(filePath, YAML.stringify(workspaceInFile));

      // Assert
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith(workspaceInDb, true);

      // Cleanup
      upsertSpy.mockRestore();
    });

    it('should throw error if id does not match', async () => {
      // Arrange
      const workspaceId = 'wrk_1';
      const neDbClient = new NeDBClient(workspaceId, DEFAULT_PROJECT_ID);
      const env = {
        _id: 'env_1',
        type: models.environment.type,
        parentId: workspaceId,
      };
      const filePath = path.join(GIT_INSOMNIA_DIR, env.type, 'env_2.yml');
      // Act
      const promiseResult = neDbClient.writeFile(filePath, YAML.stringify(env));
      // Assert
      await expect(promiseResult).rejects.toThrowError(
        'Doc _id does not match file path [env_1 != env_2]',
      );
    });

    it('should throw error if type does not match', async () => {
      // Arrange
      const workspaceId = 'wrk_1';
      const neDbClient = new NeDBClient(workspaceId, DEFAULT_PROJECT_ID);
      const env = {
        _id: 'env_1',
        type: models.environment.type,
        parentId: workspaceId,
      };
      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, `${env._id}.yml`);
      // Act
      const promiseResult = neDbClient.writeFile(filePath, YAML.stringify(env));
      // Assert
      await expect(promiseResult).rejects.toThrowError(
        'Doc type does not match file path [Environment != Request]',
      );
    });
  });

  describe('mkdir()', () => {
    it('should throw error', async () => {
      const workspaceId = 'wrk_1';
      const neDbClient = new NeDBClient(workspaceId, DEFAULT_PROJECT_ID);
      const promiseResult = neDbClient.mkdir();
      await expect(promiseResult).rejects.toThrowError('NeDBClient is not writable');
    });
  });
});
