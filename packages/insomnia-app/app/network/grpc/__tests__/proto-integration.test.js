// @flow
import path from 'path';
import fs from 'fs';
import os from 'os';
import * as protoManager from '../proto-manager';
import * as protoLoader from '../proto-loader';
import * as models from '../../../models';
import { globalBeforeEach } from '../../../__jest__/before-each';
import selectFileOrFolder from '../../../common/select-file-or-folder';

jest.mock('../../../common/select-file-or-folder', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('proto management integration test', () => {
  beforeEach(globalBeforeEach);

  it('can ingest proto file and load methods from it', async () => {
    const w = await models.workspace.create();

    // Mock folder selection
    const protoFilePath = path.join(__dirname, '../__fixtures__/library/hello.proto');
    selectFileOrFolder.mockResolvedValue({ filePath: protoFilePath });

    // Ingest into database
    let createdProtoFileId;
    await protoManager.addFile(w._id, id => {
      createdProtoFileId = id;
    });

    expect(selectFileOrFolder).toHaveBeenCalledWith({
      itemTypes: ['file'],
      extensions: ['proto'],
    });

    // Find proto file entries
    const helloProto = await models.protoFile.getById(createdProtoFileId);

    // Load protoMethods
    const helloMethods = await protoLoader.loadMethods(helloProto);

    expect(helloMethods.length).toBe(4);
  });

  it('can ingest proto directory tree and load methods from any file', async () => {
    const w = await models.workspace.create();

    // Mock folder selection
    const libraryDirPath = path.join(__dirname, '../__fixtures__/library');
    selectFileOrFolder.mockResolvedValue({ filePath: libraryDirPath });

    // Ingest into database
    await protoManager.addDirectory(w._id);

    expect(selectFileOrFolder).toHaveBeenCalledWith({
      itemTypes: ['directory'],
      extensions: ['proto'],
    });

    // Find proto file entries
    const protoFiles = await models.protoFile.all();
    const rootProto = protoFiles.find(pf => pf.name === 'root.proto');
    const helloProto = protoFiles.find(pf => pf.name === 'hello.proto');
    const timeProto = protoFiles.find(pf => pf.name === 'time.proto');

    // Load protoMethods
    const rootMethods = await protoLoader.loadMethods(rootProto);
    const helloMethods = await protoLoader.loadMethods(helloProto);
    const timeMethods = await protoLoader.loadMethods(timeProto);

    expect(rootMethods.length).toBe(helloMethods.length + timeMethods.length);
    expect(helloMethods.length).toBe(4);
    expect(timeMethods.length).toBe(1);

    // Create request
    const gr = await models.grpcRequest.create({
      parentId: w._id,
      protoFileId: rootProto._id,
      protoMethodName: rootMethods[0].path,
    });

    // Load selected method
    const selectedMethod = await protoLoader.getSelectedMethod(gr);

    expect(selectedMethod.originalName).toEqual(rootMethods[0].originalName);
  });

  afterEach(async () => {
    const tempDirPath = path.join(os.tmpdir(), 'insomnia-grpc');
    await fs.promises.rmdir(tempDirPath, { recursive: true });
  });
});
