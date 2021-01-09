import * as db from './database';
import { types as modelTypes, stats } from '../models';
import { sendRequest } from '../network/network';
import { getBodyBuffer } from '../models/response';

export async function getSendRequestCallbackMemDb(environmentId, memDB) {
  // Initialize the DB in-memory and fill it with data if we're given one
  await db.init(modelTypes(), { inMemoryOnly: true }, true, () => {});

  const docs = [];
  for (const type of Object.keys(memDB)) {
    for (const doc of memDB[type]) {
      docs.push(doc);
    }
  }

  await db.batchModifyDocs({ upsert: docs, remove: [] });

  // Return callback helper to send requests
  return async function sendRequestCallback(requestId, requestSettings) {
    return sendAndTransform(requestId, environmentId, requestSettings);
  };
}

export function getSendRequestCallback(environmentId) {
  return async function sendRequestCallback(requestId, requestSettings) {
    console.log('settings', requestSettings);
    stats.incrementExecutedRequests();
    return sendAndTransform(requestId, environmentId, requestSettings);
  };
}

async function sendAndTransform(requestId, environmentId, requestSettings) {
  const res = await sendRequest({ requestId, environmentId, requestSettings });
  const headersObj = {};
  for (const h of res.headers || []) {
    const name = h.name || '';
    headersObj[name.toLowerCase()] = h.value || '';
  }

  const bodyBuffer = await getBodyBuffer(res);

  return {
    status: res.statusCode,
    statusMessage: res.statusMessage,
    data: bodyBuffer ? bodyBuffer.toString('utf8') : undefined,
    headers: headersObj,
  };
}
