// @flow

import * as models from '../../models';
import { getRenderedGrpcRequestAndContext, RENDER_PURPOSE_SEND } from '../../common/render';
import type { RenderedGrpcRequest } from '../../common/render';
import * as protoLoader from './proto-loader';
import { getMethodType, GrpcMethodTypeEnum } from './method';

export const prepareGrpcRequest = async (
  requestId: string,
  environmentId?: string,
): Promise<RenderedGrpcRequest> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');

  const method = await protoLoader.getSelectedMethod(req);
  const methodType = getMethodType(method);

  const { request } = await getRenderedGrpcRequestAndContext(
    req,
    environment || null,
    RENDER_PURPOSE_SEND,
    {},
    methodType === GrpcMethodTypeEnum.unary,
  );

  return { request };
};
