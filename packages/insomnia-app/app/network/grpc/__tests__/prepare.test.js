import { prepareGrpcMessage, prepareGrpcRequest } from '../prepare';
import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import {
  getRenderedGrpcRequestAndContext,
  GrpcRenderOptionEnum,
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
      getRenderedGrpcRequestAndContext.mockResolvedValue({ request: gr });

      const result = await prepareGrpcRequest(gr._id, env._id, methodType);

      expect(getRenderedGrpcRequestAndContext).toHaveBeenLastCalledWith(
        gr,
        env,
        RENDER_PURPOSE_SEND,
        {},
        GrpcRenderOptionEnum.all,
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
      getRenderedGrpcRequestAndContext.mockResolvedValue({ request: gr });

      const result = await prepareGrpcRequest(gr._id, env._id, methodType);

      expect(getRenderedGrpcRequestAndContext).toHaveBeenLastCalledWith(
        gr,
        env,
        RENDER_PURPOSE_SEND,
        {},
        GrpcRenderOptionEnum.ignoreBody,
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

    getRenderedGrpcRequestAndContext.mockResolvedValue({ request: gr });

    const result = await prepareGrpcMessage(gr._id, env._id);

    expect(getRenderedGrpcRequestAndContext).toHaveBeenLastCalledWith(
      gr,
      env,
      RENDER_PURPOSE_SEND,
      {},
      GrpcRenderOptionEnum.onlyBody,
    );

    expect(result).toEqual({ body: gr.body, requestId: gr._id });
  });
});
