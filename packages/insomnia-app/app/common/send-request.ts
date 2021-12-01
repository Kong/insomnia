import { stats } from '../models';
import { sendAndTransform } from '../network/network';

export function getSendRequestCallback(environmentId?: string) {
  return async function sendRequest(requestId: string) {
    stats.incrementExecutedRequests();
    return sendAndTransform(requestId, environmentId);
  };
}
