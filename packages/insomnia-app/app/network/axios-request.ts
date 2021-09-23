import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { setDefaultProtocol } from 'insomnia-url';
import { parse as urlParse } from 'url';

import { isDevelopment } from '../common/constants';
import * as models from '../models';

export async function axiosRequest(config: AxiosRequestConfig) {
  const settings = await models.settings.getOrCreate();
  const isHttps = config.url?.indexOf('https:') === 0;
  let proxyUrl: string | null = null;

  if (isHttps && settings.httpsProxy) {
    proxyUrl = settings.httpsProxy;
  } else if (settings.httpProxy) {
    proxyUrl = settings.httpProxy;
  }

  const finalConfig: AxiosRequestConfig = {
    ...config,
    adapter: global.require('axios/lib/adapters/http'),
    httpsAgent: new https.Agent({
      rejectUnauthorized: settings.validateSSL,
    }),
  };

  if (proxyUrl) {
    const { hostname, port } = urlParse(setDefaultProtocol(proxyUrl));

    if (hostname && port) {
      finalConfig.proxy = {
        host: hostname,
        port: parseInt(port, 10),
      };
    }
  }

  const response = await axios(finalConfig);

  if (isDevelopment()) {
    console.log('[axios] Response', {
      config,
      response,
    });
  }

  return response;
}
