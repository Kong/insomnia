import fs from 'node:fs';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { RESPONSE_CODE_REASONS } from 'insomnia/src/common/constants';
import { curlRequest } from 'insomnia/src/main/network/libcurl-promise';
import { v4 as uuidv4 } from 'uuid';

import * as models from '../../../models';
import type { ClientCertificate } from '../../../models/client-certificate';
import type { Request } from '../../../models/request';
import { readCurlResponse, type ResponseHeader } from '../../../models/response';
import { setDefaultProtocol } from '../../../utils/url/protocol';

type NodeCurlRequestType = Pick<Request, 'url' | 'method' | 'headers'> &
  Partial<Pick<Request, 'body' | 'authentication'>>;
interface NodeCurlRequestOptions {
  request: NodeCurlRequestType;
  certificates?: ClientCertificate[];
  caCertificatePath?: string;
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
  const { certificates = [], caCertificatePath = null } = options;
  const requestId = uuidv4();
  const settings = await models.settings.get();
  const { followRedirects } = settings;
  const settingFollowRedirects = followRedirects ? 'on' : 'off';

  const { request: originRequest } = options;
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
    certificates,
    caCertficatePath: caCertificatePath,
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

// create http/https agent to consume proxy and certificate options
export const createAgent = async (
  options: Omit<NodeCurlRequestOptions, 'request'>,
): Promise<{ httpAgent: HttpAgent; httpsAgent: HttpsAgent }> => {
  const { caCertificatePath = null } = options;
  const settings = await models.settings.get();
  const { validateSSL, proxyEnabled, httpsProxy, httpProxy } = settings;
  let caCert;
  try {
    if (caCertificatePath) {
      caCert = await fs.promises.readFile(caCertificatePath).toString();
    }
  } catch (error) {
    console.error(`Error reading CA certificate file in ${caCertificatePath}`, error);
  }
  if (proxyEnabled) {
    const httpProxyUrl = httpProxy ? setDefaultProtocol(httpProxy) : '';
    const httpsProxyUrl = httpsProxy ? setDefaultProtocol(httpsProxy) : '';
    return {
      httpAgent: new HttpProxyAgent({
        proxy: httpProxyUrl,
      }),
      httpsAgent: new HttpsProxyAgent({
        proxy: httpsProxyUrl,
        rejectUnauthorized: validateSSL,
        ...(caCert && { ca: [caCert] }),
      }),
    };
  }
  // return default agent with ca and ssl validation options
  return {
    httpAgent: new HttpAgent(),
    httpsAgent: new HttpsAgent({
      rejectUnauthorized: validateSSL,
      ...(caCert && { ca: [caCert] }),
    }),
  };
};
