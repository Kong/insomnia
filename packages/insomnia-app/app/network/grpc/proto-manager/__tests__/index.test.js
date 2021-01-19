// @flow

import fs from 'fs';
import path from 'path';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import selectFileOrFolder from '../../../../common/select-file-or-folder';
import * as protoManager from '../index';
import * as protoLoader from '../../proto-loader';
import * as models from '../../../../models';
import * as modals from '../../../../ui/components/modals';
import * as db from '../../../../common/database';

jest.mock('../../../../common/select-file-or-folder', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../../ui/components/modals');
jest.mock('../../proto-loader');

describe('protoManager', () => {
  const selectFileOrFolderMock: JestMockFn<*, *> = selectFileOrFolder;

  beforeEach(() => {
    globalBeforeEach();
    jest.resetAllMocks();
  });

  describe('addFile', () => {
    it('should not create database entry if file loading canceled', async () => {
      // Arrange
      const cbMock = jest.fn();
      const w = await models.workspace.create();
      selectFileOrFolderMock.mockResolvedValue({ canceled: true });

      // Act
      await protoManager.addFile(w._id, cbMock);

      // Assert
      expect(cbMock).not.toHaveBeenCalled();
      const pf = await models.protoFile.getByParentId(w._id);
      expect(pf).toBeNull();

      expect(selectFileOrFolderMock).toHaveBeenCalledWith({
        itemTypes: ['file'],
        extensions: ['proto'],
      });
    });

    it('should not create database entry if file loading throws error', async () => {
      // Arrange
      const cbMock = jest.fn();
      const w = await models.workspace.create();
      const error = new Error();
      selectFileOrFolderMock.mockRejectedValue(error);

      // Act
      await protoManager.addFile(w._id, cbMock);

      // Assert
      expect(cbMock).not.toHaveBeenCalled();
      const pf = await models.protoFile.getByParentId(w._id);
      expect(pf).toBeNull();

      expect(modals.showError).toHaveBeenCalledWith({ error });
    });

    it('should not create database entry if methods cannot be parsed', async () => {
      // Arrange
      const cbMock = jest.fn();
      const w = await models.workspace.create();
      const error = new Error();
      const filePath = 'path';
      selectFileOrFolderMock.mockResolvedValue({ filePath });
      protoLoader.loadMethodsFromPath.mockRejectedValue(error);

      // Act
      await protoManager.addFile(w._id, cbMock);

      // Assert
      expect(cbMock).not.toHaveBeenCalled();
      const pf = await models.protoFile.getByParentId(w._id);
      expect(pf).toBeNull();

      expect(modals.showError).toHaveBeenCalledWith({
        title: 'Invalid Proto File',
        message: `The file ${filePath} and could not be parsed`,
        error,
      });
    });

    it('should create database entry', async () => {
      // Arrange
      const cbMock = jest.fn();
      const w = await models.workspace.create();
      const filePath = 'filename.proto';
      selectFileOrFolderMock.mockResolvedValue({ filePath });
      protoLoader.loadMethodsFromPath.mockResolvedValue();

      const fsReadFileSpy = jest.spyOn(fs.promises, 'readFile');
      const contents = 'contents';
      fsReadFileSpy.mockResolvedValue(contents);

      // Act
      await protoManager.addFile(w._id, cbMock);

      // Assert
      const pf = await models.protoFile.getByParentId(w._id);
      expect(cbMock).toHaveBeenCalledWith(pf._id);

      expect(pf.name).toBe(filePath);
      expect(pf.protoText).toBe(contents);
    });
  });

  describe('updateFile', () => {
    it('should update database entry', async () => {
      // Arrange
      const cbMock = jest.fn();
      const w = await models.workspace.create();
      const pf = await models.protoFile.create({ parentId: w._id });

      const filePath = 'filename.proto';
      selectFileOrFolderMock.mockResolvedValue({ filePath });
      protoLoader.loadMethodsFromPath.mockResolvedValue();

      const fsReadFileSpy = jest.spyOn(fs.promises, 'readFile');
      const contents = 'contents';
      fsReadFileSpy.mockResolvedValue(contents);

      // Act
      await protoManager.updateFile(pf, cbMock);

      // Assert
      expect(cbMock).toHaveBeenCalledWith(pf._id);

      const updatedPf = await models.protoFile.getById(pf._id);
      expect(updatedPf.name).toBe(filePath);
      expect(updatedPf.protoText).toBe(contents);
    });
  });

  describe('renameFile', () => {
    it('should rename the file', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pf = await models.protoFile.create({ parentId: w._id, name: 'original' });

      // Act
      const updatedName = 'updated';
      await protoManager.renameFile(pf, updatedName);

      // Assert
      const updatedPf = await models.protoFile.getById(pf._id);
      expect(updatedPf.name).toBe(updatedName);
    });
  });

  describe('deleteFile', () => {
    it('should alert the user before deleting a file', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pf = await models.protoFile.create({ parentId: w._id, name: 'pfName.proto' });
      const cbMock = jest.fn();

      // Act
      await protoManager.deleteFile(pf, cbMock);
      const showAlertCallArg = (modals.showAlert: JestMockFn).mock.calls[0][0];
      expect(showAlertCallArg.title).toBe('Delete pfName.proto');
      await showAlertCallArg.onConfirm();

      // Assert
      expect(cbMock).toHaveBeenCalledWith(pf._id);
      await expect(models.protoFile.getById(pf._id)).resolves.toBeNull();
    });
  });

  describe('deleteDirectory', () => {
    it('should alert the user before deleting a directory', async () => {
      // Arrange
      const w = await models.workspace.create();
      const pd = await models.protoDirectory.create({ parentId: w._id, name: 'pdName' });
      const pf1 = await models.protoFile.create({ parentId: pd._id, name: 'pfName1.proto' });
      const pf2 = await models.protoFile.create({ parentId: pd._id, name: 'pfName2.proto' });

      const cbMock = jest.fn();

      // Act
      await protoManager.deleteDirectory(pd, cbMock);
      const showAlertCallArg = (modals.showAlert: JestMockFn).mock.calls[0][0];
      expect(showAlertCallArg.title).toBe('Delete pdName');
      await showAlertCallArg.onConfirm();

      // Assert
      expect(cbMock).toHaveBeenCalledWith(expect.arrayContaining([pf1._id, pf2._id]));
      await expect(models.protoDirectory.getById(pd._id)).resolves.toBeNull();
      await expect(models.protoFile.getById(pf1._id)).resolves.toBeNull();
      await expect(models.protoFile.getById(pf2._id)).resolves.toBeNull();
    });
  });

  describe('addDirectory', () => {
    let dbBufferChangesSpy: * | JestMockFn<*, *>;
    let dbFlushChangesSpy: * | JestMockFn<*, *>;

    beforeEach(() => {
      dbBufferChangesSpy = jest.spyOn(db, 'bufferChanges');
      dbFlushChangesSpy = jest.spyOn(db, 'flushChanges');
    });

    afterEach(() => {
      expect(dbBufferChangesSpy).toHaveBeenCalled();
      expect(dbFlushChangesSpy).toHaveBeenCalled();
    });

    it('should not create database entries if loading canceled', async () => {
      // Arrange
      const w = await models.workspace.create();
      selectFileOrFolderMock.mockResolvedValue({ canceled: true });

      // Act
      await protoManager.addDirectory(w._id);

      // Assert
      await expect(models.protoDirectory.all()).resolves.toHaveLength(0);
      await expect(models.protoFile.all()).resolves.toHaveLength(0);
    });

    it('should not create database entry if file loading throws error', async () => {
      // Arrange
      const w = await models.workspace.create();
      const error = new Error();
      selectFileOrFolderMock.mockRejectedValue(error);

      // Act
      await protoManager.addDirectory(w._id);

      // Assert
      await expect(models.protoDirectory.all()).resolves.toHaveLength(0);
      await expect(models.protoFile.all()).resolves.toHaveLength(0);

      expect(modals.showError).toHaveBeenCalledWith({ error });
    });

    it('should show alert if no directory was created', async () => {
      // Arrange
      const w = await models.workspace.create();
      const filePath = path.join(__dirname, '../../__fixtures__/', 'library', 'empty');
      selectFileOrFolderMock.mockResolvedValue({ filePath });

      // Act
      await protoManager.addDirectory(w._id);

      // Assert
      await expect(models.protoDirectory.all()).resolves.toHaveLength(0);
      await expect(models.protoFile.all()).resolves.toHaveLength(0);

      expect(modals.showAlert).toHaveBeenCalledWith({
        title: 'No files found',
        message: `No .proto files were found under ${filePath}.`,
      });
    });

    it('should create database entries', async () => {
      // Arrange
      const w = await models.workspace.create();
      const filePath = path.join(__dirname, '../../__fixtures__/', 'library');
      selectFileOrFolderMock.mockResolvedValue({ filePath });

      // Act
      await protoManager.addDirectory(w._id);

      // Assert
      await expect(models.protoDirectory.all()).resolves.toHaveLength(3);
      await expect(models.protoFile.all()).resolves.toHaveLength(3);

      // Each individual entry is not validated here because it is
      // too involved to mock everything, and an integration test exists
      // which uses this code path. As long as the expected number of
      // entities are loaded from the fixture directory, this test is sufficient.
    });
  });
});
