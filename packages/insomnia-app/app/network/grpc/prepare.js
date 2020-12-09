// @flow
import type { RenderedGrpcRequest, RenderedGrpcRequestBody } from '../../common/render';
import type { GrpcMethodType } from './method';
import * as models from '../../models';
import {
  getRenderedGrpcRequestAndContext,
  GrpcRenderOptionEnum,
  RENDER_PURPOSE_SEND,
} from '../../common/render';
import { GrpcMethodTypeEnum } from './method';

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

  const { request } = await getRenderedGrpcRequestAndContext(
    req,
    environment || null,
    RENDER_PURPOSE_SEND,
    {},
    methodType === GrpcMethodTypeEnum.unary
      ? GrpcRenderOptionEnum.all
      : GrpcRenderOptionEnum.ignoreBody,
  );

  return { request };
};

export const prepareGrpcMessage = async (
  requestId: string,
  environmentId: string,
): Promise<GrpcIpcMessageParams> => {
  const req = await models.grpcRequest.getById(requestId);
  const environment = await models.environment.getById(environmentId || 'n/a');

  const { request } = await getRenderedGrpcRequestAndContext(
    req,
    environment || null,
    RENDER_PURPOSE_SEND,
    {},
    GrpcRenderOptionEnum.onlyBody,
  );

  return { body: request.body, requestId: req._id };
};
