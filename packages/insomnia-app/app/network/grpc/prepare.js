// @flow
import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import type { GrpcMethodType } from './method';
import * as models from '../../models';
import {
  getRenderedGrpcRequest,
  getRenderedGrpcRequestMessage,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import { canClientStream } from './method';

export type GrpcIpcRequestParams = {
  request: RenderedGrpcRequest,
};

export type GrpcIpcMessageParams = {
  requestId: string,
  body: RenderedGrpcRequestBody,
};

export const prepareGrpcRequest = async (
  requestId: string,
  environmentId: string,
  methodType: GrpcMethodType,
): Promise<GrpcIpcRequestParams> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');

  const request = await getRenderedGrpcRequest(
    req,
    environment,
    RENDER_PURPOSE_SEND,
    {},
    canClientStream(methodType),
  );

  return { request };
};

export const prepareGrpcMessage = async (
  requestId: string,
  environmentId: string,
): Promise<GrpcIpcMessageParams> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');

  const requestBody = await getRenderedGrpcRequestMessage(
    req,
    environment,
    RENDER_PURPOSE_SEND,
    {},
  );

  return { body: requestBody, requestId: req._id };
};
