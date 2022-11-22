import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mocked } from 'jest-mock';

import { globalBeforeEach } from '../../../__jest__/before-each';
import {
  getRenderedGrpcRequest as _getRenderedGrpcRequest,
  getRenderedGrpcRequestMessage as _getRenderedGrpcRequestMessage,
  RENDER_PURPOSE_SEND,
} from '../../../common/render';
import * as models from '../../../models';
import { prepareGrpcMessage, prepareGrpcRequest } from '../prepare';

jest.mock('../../../common/render');

const getRenderedGrpcRequest = mocked(_getRenderedGrpcRequest);
const getRenderedGrpcRequestMessage = mocked(_getRenderedGrpcRequestMessage);

describe('prepareGrpcRequest', () => {
  beforeEach(globalBeforeEach);

  it.each(['unary', 'server'])(
    'should prepare grpc request with all properties: %s',
    async methodType => {
      const w = await models.workspace.create();
      const env = await models.environment.create({
        parentId: w._id,
      });
      const gr = await models.grpcRequest.create({
        parentId: w._id,
      });
      getRenderedGrpcRequest.mockResolvedValue(gr);
      const result = await prepareGrpcRequest(gr._id, env._id, methodType);
      expect(getRenderedGrpcRequest).toHaveBeenLastCalledWith(
        {
          request: gr,
          environmentId: env._id,
          purpose: RENDER_PURPOSE_SEND,
          skipBody: false,
        },
      );
      expect(result).toEqual({
        request: gr,
      });
    },
  );

  it.each(['client', 'bidi'])(
    'should prepare grpc request and ignore body: %s',
    async methodType => {
      const w = await models.workspace.create();
      const env = await models.environment.create({
        parentId: w._id,
      });
      const gr = await models.grpcRequest.create({
        parentId: w._id,
      });
      getRenderedGrpcRequest.mockResolvedValue(gr);
      const result = await prepareGrpcRequest(gr._id, env._id, methodType);
      expect(getRenderedGrpcRequest).toHaveBeenLastCalledWith(
        {
          request: gr,
          environmentId: env._id,
          purpose: RENDER_PURPOSE_SEND,
          skipBody: true,
        },
      );
      expect(result).toEqual({
        request: gr,
      });
    },
  );
});
