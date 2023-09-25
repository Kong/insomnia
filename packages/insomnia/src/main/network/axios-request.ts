import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as https from 'https';
import { parse as urlParse } from 'url';

import { isDevelopment } from '../../common/constants';
import * as models from '../../models';
import { isUrlMatchedInNoProxyRule } from '../../network/is-url-matched-in-no-proxy-rule';
import { setDefaultProtocol } from '../../utils/url/protocol';
export const axiosRequest = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
  const settings = await models.settings.get();
  const isHttps = config.url?.indexOf('https:') === 0;
  let proxyUrl: string | null = null;

  if (isHttps && settings.httpsProxy) {
    proxyUrl = settings.httpsProxy;
  } else if (settings.httpProxy) {
    proxyUrl = settings.httpProxy;
  }

  const finalConfig: AxiosRequestConfig = {
    ...config,
    httpsAgent: new https.Agent({
      rejectUnauthorized: settings.validateSSL,
    }),
    // ignore HTTP_PROXY, HTTPS_PROXY, NO_PROXY environment variables
    proxy: false,
  };
  // hack for http-client
  const isArrayBuffer = Array.isArray(config.data) && config.responseType === 'arraybuffer';
  if (isArrayBuffer) {
    finalConfig.data = Buffer.concat(config.data);
  }
  if (settings.proxyEnabled && proxyUrl && !isUrlMatchedInNoProxyRule(finalConfig.url, settings.noProxy)) {
    const { hostname, port } = urlParse(setDefaultProtocol(proxyUrl));

    if (hostname && port) {
      finalConfig.proxy = {
        host: hostname,
        port: parseInt(port, 10),
      };
    }
  }
  // HACK: workaround for isomteric git needing 400 responses
  if (config.responseType === 'arraybuffer') {
    console.log('[git-sync] Overriding validateStatus to allow 400 responses');
    finalConfig.validateStatus = status => status < 500;
  }
  const response = await axios(finalConfig);

  if (isDevelopment()) {
    console.log('[axios] Response', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: !!response.data,
      config: {
        method: response.config.method,
        url: response.config.url,
        proxy: response.config.proxy,
        headers: response.config.headers,
      },
    });
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data,
    config: {
      method: response.config.method,
      url: response.config.url,
      proxy: response.config.proxy,
      headers: response.config.headers,
    },
  };
};
