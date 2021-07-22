import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import {
  getRenderedGrpcRequest,
  getRenderedGrpcRequestMessage,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import * as models from '../../models';
import type { GrpcMethodType } from './method';
import { canClientStream } from './method';

export interface GrpcIpcRequestParams {
  request: RenderedGrpcRequest;
}

export interface GrpcIpcMessageParams {
  requestId: string;
  body: RenderedGrpcRequestBody;
}

export const prepareGrpcRequest = async (
  requestId: string,
  environmentId: string,
  methodType: GrpcMethodType,
): Promise<GrpcIpcRequestParams> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');
  const request = await getRenderedGrpcRequest(
    // @ts-expect-error -- TSCONVERSION req can be null but should not try to render if it is null
    req,
    environment,
    RENDER_PURPOSE_SEND,
    {},
    canClientStream(methodType),
  );
  return {
    request,
  };
};

export const prepareGrpcMessage = async (
  requestId: string,
  environmentId: string,
): Promise<GrpcIpcMessageParams> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');
  const requestBody = await getRenderedGrpcRequestMessage(
    // @ts-expect-error -- TSCONVERSION req can be null but should not try to render if it is null
    req,
    environment,
    RENDER_PURPOSE_SEND,
    {},
  );
  return {
    body: requestBody,
    // @ts-expect-error -- TSCONVERSION req can be null
    requestId: req._id,
  };
};
