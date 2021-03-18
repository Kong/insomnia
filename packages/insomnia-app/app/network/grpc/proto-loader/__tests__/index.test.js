// @flow
import * as protoLoader from '../index';
import writeProtoFile from '../write-proto-file';
import path from 'path';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import * as models from '../../../../models';

jest.mock('../write-proto-file', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('loadMethods', () => {
  const protoFilePath = path.join(__dirname, '../../__fixtures__/library/hello.proto');

  beforeEach(() => {
    globalBeforeEach();
    jest.resetAllMocks();
  });

  it('should load methods', async () => {
    const w = await models.workspace.create();
    const pf = await models.protoFile.create({
      parentId: w._id,
      protoText: 'this is just a placeholder because writing to a file is mocked',
    });
    writeProtoFile.mockResolvedValue({ filePath: protoFilePath, dirs: [] });

    const methods = await protoLoader.loadMethods(pf);

    expect(writeProtoFile).toHaveBeenCalledWith(pf);

    expect(methods).toHaveLength(4);
    expect(methods.map(c => c.path)).toStrictEqual(
      expect.arrayContaining([
        '/hello.HelloService/SayHello',
        '/hello.HelloService/LotsOfReplies',
        '/hello.HelloService/LotsOfGreetings',
        '/hello.HelloService/BidiHello',
      ]),
    );
  });

  it('should load no methods if protofile does not exist or is empty', async () => {
    const w = await models.workspace.create();
    const pf = await models.protoFile.create({
      parentId: w._id,
      protoText: '',
    });

    await expect(protoLoader.loadMethods(undefined)).resolves.toHaveLength(0);
    await expect(protoLoader.loadMethods(pf)).resolves.toHaveLength(0);
  });
});
