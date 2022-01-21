import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import { setDefaultProtocol } from 'insomnia-url';
import { parse as urlParse } from 'url';

import { isDevelopment } from '../common/constants';
import * as models from '../models';
import { isUrlMatchedInNoProxyRule } from './is-url-matched-in-no-proxy-rule';

export const axiosRequestWithOptionalSSLVerify = async (config: AxiosRequestConfig) => {
  const settings = await models.settings.getOrCreate();
  return axiosRequestWithUserDefinedProxy({
    ...config,
    httpsAgent: new https.Agent({
      rejectUnauthorized: settings.validateSSL,
    }),
  });
};

export const axiosRequestWithUserDefinedProxy = async (config: AxiosRequestConfig) => {
  const settings = await models.settings.getOrCreate();
  const isHttps = config.url?.startsWith('https:');
  let proxyUrl: string | null = null;

  if (isHttps && settings.httpsProxy) {
    proxyUrl = settings.httpsProxy;
  } else if (settings.httpProxy) {
    proxyUrl = settings.httpProxy;
  }

  // ignore HTTP_PROXY, HTTPS_PROXY, NO_PROXY environment variables
  config.proxy = false;
  if (settings.proxyEnabled && proxyUrl && !isUrlMatchedInNoProxyRule(config.url, settings.noProxy)) {
    const { hostname, port } = urlParse(setDefaultProtocol(proxyUrl));

    if (hostname && port) {
      config.proxy = {
        host: hostname,
        port: parseInt(port, 10),
      };
    }
  }
  return axiosRequest(config);
};

export async function axiosRequest(config: AxiosRequestConfig) {
  // NOTE axios default adapter is XMLHttpRequest which only works in the renderer
  config.adapter = global.require('axios/lib/adapters/http');
  const response = await axios(config);

  if (isDevelopment()) {
    console.log('[axios] Response', {
      config,
      response,
    });
  }

  return response;
}
