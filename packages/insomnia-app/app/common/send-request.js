import * as db from './database';
import { types as modelTypes, stats } from '../models';
import { send } from '../network/network';
import { getBodyBuffer } from '../models/response';
import * as plugins from '../plugins';

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
  return async function sendRequest(requestId) {
    return sendAndTransform(requestId, environmentId);
  };
}

export function getSendRequestCallback(environmentId) {
  return async function sendRequest(requestId) {
    stats.incrementExecutedRequests();
    return sendAndTransform(requestId, environmentId);
  };
}

async function sendAndTransform(requestId, environmentId) {
  try {
    plugins.ignorePlugin('insomnia-plugin-kong-bundle');
    const res = await send(requestId, environmentId);
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
  } finally {
    plugins.clearIgnores();
  }
}
