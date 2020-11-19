// @flow
import * as protoLoader from '../proto-loader';
import writeProtoFile from '../write-proto-file';
import path from 'path';

jest.mock('../write-proto-file', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const protoFile = {
  protoText: 'this is just a placeholder because writing to a file is mocked',
};

describe('loadMethods', () => {
  const protoFilePath = path.join(__dirname, '../__fixtures__/hello.proto');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should load methods', async () => {
    writeProtoFile.mockResolvedValue(protoFilePath);

    const methods = await protoLoader.loadMethods(protoFile);

    expect(writeProtoFile).toHaveBeenCalledWith(protoFile.protoText);

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
});
