// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeProtoFile } from '../write-proto-file.node';

describe('writeProtoFile', () => {
  let existsSyncSpy;
  let tmpDirSpy;
  let writeFileSpy;

  const _setupSpies = () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync');
    tmpDirSpy = vi.spyOn(os, 'tmpdir');
    writeFileSpy = vi.spyOn(fs.promises, 'writeFile');
  };

  const _configureSpies = (tmpDir: string, exists: boolean) => {
    existsSyncSpy.mockReturnValue(exists);
    tmpDirSpy.mockReturnValue(tmpDir);
    writeFileSpy.mockResolvedValue();
  };

  const _restoreSpies = () => {
    existsSyncSpy.mockRestore();
    tmpDirSpy.mockRestore();
    writeFileSpy.mockRestore();
  };

  beforeEach(async () => {
    _setupSpies();
  });

  afterEach(() => {
    _restoreSpies();

    vi.resetAllMocks();
  });

  describe('individual files', () => {
    it('can write individual file', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pf = await services.protoFile.create({
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
      const w = await services.workspace.create();
      const pf = await services.protoFile.create({
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
      const w = await services.workspace.create();
      const pd = await services.protoDirectory.create({
        parentId: w._id,
        name: 'dirName',
      });
      const pf = await services.protoFile.create({
        parentId: pd._id,
        name: 'hello.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false); // file doesn't already exist

      // Act
      const result = await writeProtoFile(pf);
      // Assert
      const expectedRootDir = path.join(tmpDirPath, 'insomnia-grpc', `${pd._id}.${pd.modified}`, pd.name);
      const expectedFilePath = pf.name;
      const expectedFullPath = path.join(expectedRootDir, expectedFilePath);
      expect(result.filePath).toEqual(expectedFilePath);
      expect(result.dirs).toEqual([expectedRootDir]);
      expect(existsSyncSpy).toHaveBeenCalledWith(expectedFullPath);
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath, pf.protoText);
    });

    it('can write files contained in nested folders', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pdRoot = await services.protoDirectory.create({
        parentId: w._id,
        name: 'rootDir',
      });
      const pdNested = await services.protoDirectory.create({
        parentId: pdRoot._id,
        name: 'nestedDir',
      });
      const pfRoot = await services.protoFile.create({
        parentId: pdRoot._id,
        name: 'root.proto',
        protoText: 'root',
      });
      const pfNested = await services.protoFile.create({
        parentId: pdNested._id,
        name: 'nested.proto',
        protoText: 'nested',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false); // files don't already exist

      // Act
      const result = await writeProtoFile(pfNested);
      // Assert
      const expectedRootDir = path.join(tmpDirPath, 'insomnia-grpc', `${pdRoot._id}.${pdRoot.modified}`, pdRoot.name);
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

    it('strips path traversal from proto file name and writes inside temp dir', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pd = await services.protoDirectory.create({
        parentId: w._id,
        name: 'dirName',
      });
      const pf = await services.protoFile.create({
        parentId: pd._id,
        name: '../../escape.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false);

      // Act
      const result = await writeProtoFile(pf);
      // Assert — traversal stripped, file written inside temp dir
      const tempRoot = path.join(tmpDirPath, 'insomnia-grpc', `${pd._id}.${pd.modified}`, pd.name);
      const expectedFullPath = path.join(tempRoot, 'escape.proto');
      expect(result.filePath).toEqual('escape.proto');
      expect(writeFileSpy).toHaveBeenCalledWith(expectedFullPath, pf.protoText);
    });

    it('strips path traversal from proto directory name and writes inside temp dir', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pd = await services.protoDirectory.create({
        parentId: w._id,
        name: '../../traversal',
      });
      const pf = await services.protoFile.create({
        parentId: pd._id,
        name: 'hello.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false);

      // Act
      const result = await writeProtoFile(pf);
      // Assert — directory traversal stripped, content written inside temp dir
      const tempBase = path.join(tmpDirPath, 'insomnia-grpc', `${pd._id}.${pd.modified}`);
      const expectedRootDir = path.join(tempBase, 'traversal');
      expect(result.dirs).toContain(expectedRootDir);
      const writtenPath = writeFileSpy.mock.calls[0][0] as string;
      expect(writtenPath.startsWith(tempBase)).toBe(true);
    });

    it('strips path separator from proto file name and writes inside temp dir', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pd = await services.protoDirectory.create({
        parentId: w._id,
        name: 'dirName',
      });
      const pf = await services.protoFile.create({
        parentId: pd._id,
        name: 'sub/escape.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false);

      // Act
      const result = await writeProtoFile(pf);
      // Assert — separator stripped, file written inside temp dir
      const tempRoot = path.join(tmpDirPath, 'insomnia-grpc', `${pd._id}.${pd.modified}`, pd.name);
      expect(result.filePath).toEqual('escape.proto');
      expect(writeFileSpy).toHaveBeenCalledWith(path.join(tempRoot, 'escape.proto'), pf.protoText);
    });

    it('writes file when directory name is exactly ".."', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pd = await services.protoDirectory.create({
        parentId: w._id,
        name: '..',
      });
      const pf = await services.protoFile.create({
        parentId: pd._id,
        name: 'hello.proto',
        protoText: 'text',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, false);

      // Act — must not throw; ".." gets replaced with "_" and write proceeds
      const result = await writeProtoFile(pf);
      const tempBase = path.join(tmpDirPath, 'insomnia-grpc', `${pd._id}.${pd.modified}`);
      const expectedRootDir = path.join(tempBase, '_');
      expect(result.dirs).toContain(expectedRootDir);
      expect(writeFileSpy).toHaveBeenCalled();
      const writtenPath = writeFileSpy.mock.calls[0][0] as string;
      expect(writtenPath.startsWith(tempBase)).toBe(true);
    });

    it('should not write file if it already exists', async () => {
      // Arrange
      const w = await services.workspace.create();
      const pdRoot = await services.protoDirectory.create({
        parentId: w._id,
        name: 'rootDir',
      });
      const pdNested = await services.protoDirectory.create({
        parentId: pdRoot._id,
        name: 'nestedDir',
      });
      const pfRoot = await services.protoFile.create({
        parentId: pdRoot._id,
        name: 'root.proto',
        protoText: 'root',
      });
      const pfNested = await services.protoFile.create({
        parentId: pdNested._id,
        name: 'nested.proto',
        protoText: 'nested',
      });
      const tmpDirPath = path.join('.', 'foo', 'bar', 'baz');

      _configureSpies(tmpDirPath, true); // files already exists

      // Act
      const result = await writeProtoFile(pfNested);
      // Assert
      const expectedRootDir = path.join(tmpDirPath, 'insomnia-grpc', `${pdRoot._id}.${pdRoot.modified}`, pdRoot.name);
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
