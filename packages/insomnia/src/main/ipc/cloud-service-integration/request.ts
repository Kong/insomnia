import { RESPONSE_CODE_REASONS } from 'insomnia/src/common/constants';
import { curlRequest } from 'insomnia/src/main/network/libcurl-promise';
import { v4 as uuidv4 } from 'uuid';

import * as models from '../../../models';
import type { Request } from '../../../models/request';
import { readCurlResponse, type ResponseHeader } from '../../../models/response';

type NodeCurlRequestType = Pick<Request, 'url' | 'method' | 'headers'> &
  Partial<Pick<Request, 'body' | 'authentication'>>;
interface NodeCurlRequestOptions {
  request: NodeCurlRequestType;
  caCertficatePath?: string;
}
export interface NodeCurlResponseType {
  body: string;
  code: number;
  reason: string;
  status: string;
  responseTime: number;
  headers: ResponseHeader[];
  json: () => any;
  ok?: boolean;
}

export const nodeCurlRequest = async (options: NodeCurlRequestOptions): Promise<NodeCurlResponseType> => {
  const requestId = uuidv4();
  const settings = await models.settings.get();
  const settingFollowRedirects = settings?.followRedirects ? 'on' : 'off';
  const { request: originRequest, caCertficatePath = null } = options;
  const response = await curlRequest({
    requestId: `cloud-service-integration-${requestId}`,
    req: {
      authentication: {},
      body: {},
      cookieJar: {
        cookies: [],
      },
      cookies: [],
      suppressUserAgent: false,
      settingFollowRedirects,
      settingRebuildPath: true,
      settingSendCookies: true,
      ...originRequest,
    },
    finalUrl: originRequest.url,
    settings,
    certificates: [],
    caCertficatePath,
  });
  const { headerResults, patch, responseBodyPath } = response;
  if (patch.error) {
    throw new Error(patch.error);
  }
  if (headerResults.length === 0) {
    throw new Error('Error in response: no header result is found');
  }
  const lastRedirect = headerResults[headerResults.length - 1];
  if (!lastRedirect) {
    throw new Error('Error in response: the lastRedirect is not defined');
  }
  const bodyResult = await readCurlResponse({
    bodyPath: responseBodyPath,
    bodyCompression: patch.bodyCompression,
  });

  return {
    code: lastRedirect.code,
    reason: lastRedirect.reason,
    headers: lastRedirect.headers,
    responseTime: patch.elapsedTime,
    body: bodyResult.body,
    ok: lastRedirect.code >= 200 && lastRedirect.code < 300,
    status: lastRedirect.reason || RESPONSE_CODE_REASONS[lastRedirect.code] || 'Unknown',
    json: () => {
      try {
        return JSON.parse(bodyResult.body);
      } catch (error) {
        throw new Error(`Error parsing JSON response: ${error}`);
      }
    },
  };
};
