import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import { SpyInstance } from 'jest-mock';
import os from 'os';
import path from 'path';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { writeProtoFile } from '../write-proto-file';

describe('writeProtoFile', () => {
  let existsSyncSpy: SpyInstance<any>;
  let tmpDirSpy: SpyInstance<any>;
  let writeFileSpy: SpyInstance<any>;

  const _setupSpies = () => {
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    tmpDirSpy = jest.spyOn(os, 'tmpdir');
    writeFileSpy = jest.spyOn(fs.promises, 'writeFile');
  };

  const _configureSpies = (tmpDir: string, exists: boolean) => {
    existsSyncSpy.mockReturnValue(exists);
    tmpDirSpy.mockReturnValue(tmpDir);
    writeFileSpy.mockResolvedValue(undefined);
  };

  const _restoreSpies = () => {
    existsSyncSpy.mockRestore();
    tmpDirSpy.mockRestore();
    writeFileSpy.mockRestore();
  };

  beforeEach(async () => {
    await globalBeforeEach();

    // Spies should be setup AFTER globalBeforeEach()
    _setupSpies();
  });

  afterEach(() => {
    _restoreSpies();

    jest.resetAllMocks();
  });

  describe('individual files', () => {
    it('can write individual file', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pf = await models.protoFile.create({
        parentId: w._id,
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false); // file doesn't already exist

      // Act
      const result = await writeProtoFile(pf);
      // Assert
      const expectedDir = path.join(tmpDirPath, 'insomnia-grpc');
      const expectedFileName = `${pf._id}.${pf.modified}.proto`;
      const expectedFullPath = path.join(expectedDir, expectedFileName);
      expect(result.filePath).toEqual(expectedFileName);
      expect(result.dirs).toEqual([expectedDir]);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath, pf.protoText);
    });

    it('doesnt write individual file if it already exists', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pf = await models.protoFile.create({
        parentId: w._id,
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, true); // file already exists

      // Act
      const result = await writeProtoFile(pf);
      // Assert
      const expectedDir = path.join(tmpDirPath, 'insomnia-grpc');
      const expectedFileName = `${pf._id}.${pf.modified}.proto`;
      const expectedFullPath = path.join(expectedDir, expectedFileName);
      expect(result.filePath).toEqual(expectedFileName);
      expect(result.dirs).toEqual([expectedDir]);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath);
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('nested files', () => {
    it('can write file contained in a single folder', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pd = await models.protoDirectory.create({
        parentId: w._id,
        name: 'dirName',
      });
      const pf = await models.protoFile.create({
        parentId: pd._id,
        name: 'hello.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false); // file doesn't already exist

      // Act
      const result = await writeProtoFile(pf);
      // Assert
      const expectedRootDir = path.join(
        tmpDirPath,
        'insomnia-grpc',
        `${pd._id}.${pd.modified}`,
        pd.name,
      );
      const expectedFilePath = pf.name;
      const expectedFullPath = path.join(expectedRootDir, expectedFilePath);
      expect(result.filePath).toEqual(expectedFilePath);
      expect(result.dirs).toEqual([expectedRootDir]);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath, pf.protoText);
    });

    it('can write files contained in nested folders', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pdRoot = await models.protoDirectory.create({
        parentId: w._id,
        name: 'rootDir',
      });
      const pdNested = await models.protoDirectory.create({
        parentId: pdRoot._id,
        name: 'nestedDir',
      });
      const pfRoot = await models.protoFile.create({
        parentId: pdRoot._id,
        name: 'root.proto',
        protoText: 'root',
      });
      const pfNested = await models.protoFile.create({
        parentId: pdNested._id,
        name: 'nested.proto',
        protoText: 'nested',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false); // files don't already exist

      // Act
      const result = await writeProtoFile(pfNested);
      // Assert
      const expectedRootDir = path.join(
        tmpDirPath,
        'insomnia-grpc',
        `${pdRoot._id}.${pdRoot.modified}`,
        pdRoot.name,
      );
      const expectedNestedDir = path.join(expectedRootDir, pdNested.name);
      const expectedFilePath = {
        root: pfRoot.name,
        nested: path.join(pdNested.name, pfNested.name),
      };
      const expectedFullPath = {
        root: path.join(expectedRootDir, expectedFilePath.root),
        nested: path.join(expectedRootDir, expectedFilePath.nested),
      };
      expect(result.filePath).toEqual(expectedFilePath.nested);
      expect(result.dirs).toEqual([expectedRootDir, expectedNestedDir]);
      // Root folder should be created and written to
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.root);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath.root, pfRoot.protoText);
      // Nested folder should be created and written to
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.nested);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath.nested, pfNested.protoText);
    });

    it('should not write file if it already exists', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pdRoot = await models.protoDirectory.create({
        parentId: w._id,
        name: 'rootDir',
      });
      const pdNested = await models.protoDirectory.create({
        parentId: pdRoot._id,
        name: 'nestedDir',
      });
      const pfRoot = await models.protoFile.create({
        parentId: pdRoot._id,
        name: 'root.proto',
        protoText: 'root',
      });
      const pfNested = await models.protoFile.create({
        parentId: pdNested._id,
        name: 'nested.proto',
        protoText: 'nested',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, true); // files already exists

      // Act
      const result = await writeProtoFile(pfNested);
      // Assert
      const expectedRootDir = path.join(
        tmpDirPath,
        'insomnia-grpc',
        `${pdRoot._id}.${pdRoot.modified}`,
        pdRoot.name,
      );
      const expectedNestedDir = path.join(expectedRootDir, pdNested.name);
      const expectedFilePath = {
        root: pfRoot.name,
        nested: path.join(pdNested.name, pfNested.name),
      };
      const expectedFullPath = {
        root: path.join(expectedRootDir, expectedFilePath.root),
        nested: path.join(expectedRootDir, expectedFilePath.nested),
      };
      expect(result.filePath).toEqual(expectedFilePath.nested);
      expect(result.dirs).toEqual([expectedRootDir, expectedNestedDir]);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.root);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.nested);
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });
});
