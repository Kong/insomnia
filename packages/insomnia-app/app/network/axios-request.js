import { parse as urlParse } from 'url';
import { setDefaultProtocol } from 'insomnia-url';
import axios from 'axios';
import * as models from '../models';
import { isDevelopment } from '../common/constants';

export async function axiosRequest(config) {
  const settings = await models.settings.getOrCreate();
  const isHttps = config.url.indexOf('https:') === 0;

  let proxyUrl = null;
  if (isHttps && settings.httpsProxy) {
    proxyUrl = settings.httpsProxy;
  } else if (settings.httpProxy) {
    proxyUrl = settings.httpProxy;
  }

  let shouldProxy = true;
  if (settings.noProxy) {
    const noProxy = settings.noProxy.split(',').map(function trim(s) {
      return s.trim();
    });

    const { hostname } = urlParse(config.url);
    shouldProxy = !noProxy.some(function proxyMatch(proxyElement) {
      if (!proxyElement) {
        return false;
      }
      if (proxyElement === '*') {
        return true;
      }
      if (
        proxyElement[0] === '.' &&
        hostname.substr(hostname.length - proxyElement.length) === proxyElement
      ) {
        return true;
      }

      return hostname === proxyElement;
    });
  }

  const finalConfig = {
    ...config,
    adapter: global.require('axios/lib/adapters/http'),
  };

  if (proxyUrl && shouldProxy) {
    const { hostname, port } = urlParse(setDefaultProtocol(proxyUrl));
    finalConfig.proxy = { host: hostname, port };
  }

  const response = await axios(finalConfig);

  if (isDevelopment()) {
    console.log('[axios] Response', { config, response });
  }

  return response;
}
