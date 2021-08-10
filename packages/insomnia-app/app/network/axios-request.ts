import axios from 'axios';
import { setDefaultProtocol } from 'insomnia-url';
import { parse as urlParse } from 'url';

import { isDevelopment } from '../common/constants';
import * as models from '../models';

export async function axiosRequest(config) {
  const settings = await models.settings.getOrCreate();
  const isHttps = config.url.indexOf('https:') === 0;
  let proxyUrl: string | null = null;

  if (isHttps && settings.httpsProxy) {
    proxyUrl = settings.httpsProxy;
  } else if (settings.httpProxy) {
    proxyUrl = settings.httpProxy;
  }

  const finalConfig = { ...config, adapter: global.require('axios/lib/adapters/http') };

  if (proxyUrl) {
    const { hostname, port } = urlParse(setDefaultProtocol(proxyUrl));
    finalConfig.proxy = {
      host: hostname,
      port,
    };
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
