// @flow
import path from 'path';
import os from 'os';
import fs from 'fs';
import * as models from '../../../../models';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import writeProtoFile from '../write-proto-file';
import mkdirp from 'mkdirp';

describe('writeProtoFile', () => {
  let mkdirpSyncSpy: * | JestMockFn<*, *>;
  let tmpDirSpy: * | JestMockFn<*, *>;
  let existsSyncSpy: * | JestMockFn<*, *>;
  let writeFileSpy: * | JestMockFn<*, Promise<*>>;

  const _setupSpies = () => {
    tmpDirSpy = jest.spyOn(os, 'tmpdir');
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    mkdirpSyncSpy = jest.spyOn(mkdirp, 'sync');
    writeFileSpy = jest.spyOn(fs.promises, 'writeFile');
  };

  const _configureSpies = (tmpDir: string, exists: boolean) => {
    mkdirpSyncSpy.mockImplementation(() => {});
    writeFileSpy.mockResolvedValue();
    tmpDirSpy.mockReturnValue(tmpDir);
    existsSyncSpy.mockReturnValue(exists);
  };

  const _restoreSpies = () => {
    tmpDirSpy.mockRestore();
    existsSyncSpy.mockRestore();
    writeFileSpy.mockRestore();
    mkdirpSyncSpy.mockRestore();
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

      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedDir);
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

      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedDir);
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

      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedRootDir);
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
      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedRootDir);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.root);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath.root, pfRoot.protoText);

      // Nested folder should be created and written to
      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedNestedDir);
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

      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedRootDir);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.root);

      expect(mkdirpSyncSpy).toHaveBeenCalledWith(expectedNestedDir);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath.nested);

      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });
});
