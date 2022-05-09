import { stats } from '../models';
import { getBodyBuffer } from '../models/response';
import * as plugins from '../plugins';
import { send } from './network';

export function getSendRequestCallback(environmentId?: string) {
  return async function sendRequest(requestId: string) {
    stats.incrementExecutedRequests();
    try {
      plugins.ignorePlugin('insomnia-plugin-kong-declarative-config');
      plugins.ignorePlugin('insomnia-plugin-kong-kubernetes-config');
      plugins.ignorePlugin('insomnia-plugin-kong-portal');
      const res = await send(requestId, environmentId);
      const { statusCode: status, statusMessage, headers: headerArray, elapsedTime: responseTime } = res;
      const headers = headerArray?.reduce((acc, { name, value }) => ({ ...acc, [name.toLowerCase() || '']: value || '' }), []);
      const bodyBuffer = await getBodyBuffer(res) as Buffer;
      const data = bodyBuffer ? bodyBuffer.toString('utf8') : undefined;
      return { status, statusMessage, data, headers, responseTime };
    } finally {
      plugins.clearIgnores();
    }
  };
}
