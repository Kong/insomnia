import { prepareGrpcMessage, prepareGrpcRequest } from '../prepare';
import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import {
  getRenderedGrpcRequest,
  getRenderedGrpcRequestMessage,
  RENDER_PURPOSE_SEND,
} from '../../../common/render';
import { GrpcMethodTypeEnum } from '../method';

jest.mock('../../../common/render');

describe('prepareGrpcRequest', () => {
  beforeEach(globalBeforeEach);

  it.each([GrpcMethodTypeEnum.unary, GrpcMethodTypeEnum.server])(
    'should prepare grpc request with all properties: %s',
    async methodType => {
      const w = await models.workspace.create();
      const env = await models.environment.create({ parentId: w._id });
      const gr = await models.grpcRequest.create({ parentId: w._id });
      getRenderedGrpcRequest.mockResolvedValue(gr);

      const result = await prepareGrpcRequest(gr._id, env._id, methodType);

      expect(getRenderedGrpcRequest).toHaveBeenLastCalledWith(
        gr,
        env,
        RENDER_PURPOSE_SEND,
        {},
        false,
      );

      expect(result).toEqual({ request: gr });
    },
  );

  it.each([GrpcMethodTypeEnum.client, GrpcMethodTypeEnum.bidi])(
    'should prepare grpc request and ignore body: %s',
    async methodType => {
      const w = await models.workspace.create();
      const env = await models.environment.create({ parentId: w._id });
      const gr = await models.grpcRequest.create({ parentId: w._id });
      getRenderedGrpcRequest.mockResolvedValue(gr);

      const result = await prepareGrpcRequest(gr._id, env._id, methodType);

      expect(getRenderedGrpcRequest).toHaveBeenLastCalledWith(
        gr,
        env,
        RENDER_PURPOSE_SEND,
        {},
        true,
      );

      expect(result).toEqual({ request: gr });
    },
  );
});

describe('prepareGrpcMessage', () => {
  beforeEach(globalBeforeEach);

  it('should prepare grpc message with only body', async () => {
    const w = await models.workspace.create();
    const env = await models.environment.create({ parentId: w._id });
    const gr = await models.grpcRequest.create({ parentId: w._id });

    getRenderedGrpcRequestMessage.mockResolvedValue(gr.body);

    const result = await prepareGrpcMessage(gr._id, env._id);

    expect(getRenderedGrpcRequestMessage).toHaveBeenLastCalledWith(
      gr,
      env,
      RENDER_PURPOSE_SEND,
      {},
    );

    expect(result).toEqual({ body: gr.body, requestId: gr._id });
  });
});
