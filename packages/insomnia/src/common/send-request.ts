import { BaseModel, stats, types as modelTypes } from '../models';
import * as models from '../models';
import { getBodyBuffer } from '../models/response';
import { Settings } from '../models/settings';
import { send } from '../network/network';
import * as plugins from '../plugins';
import { database } from './database';

// The network layer uses settings from the settings model
// We want to give consumers the ability to override certain settings
type SettingsOverride = Pick<Settings, 'validateSSL'>;

export async function getSendRequestCallbackMemDb(environmentId: string, memDB: any, settingsOverrides?: SettingsOverride) {
  // Initialize the DB in-memory and fill it with data if we're given one
  await database.init(
    modelTypes(),
    {
      inMemoryOnly: true,
    },
    true,
    () => { },
  );
  const docs: BaseModel[] = [];

  const settings = await models.settings.getOrCreate();
  docs.push({ ...settings, ...settingsOverrides });

  for (const type of Object.keys(memDB)) {
    for (const doc of memDB[type]) {
      docs.push(doc);
    }
  }

  await database.batchModifyDocs({
    upsert: docs,
    remove: [],
  });

  // Return callback helper to send requests
  return async function sendRequest(requestId: string) {
    return sendAndTransform(requestId, environmentId);
  };
}

export function getSendRequestCallback(environmentId?: string) {
  return async function sendRequest(requestId: string) {
    stats.incrementExecutedRequests();
    return sendAndTransform(requestId, environmentId);
  };
}

async function sendAndTransform(requestId: string, environmentId?: string) {
  try {
    plugins.ignorePlugin('insomnia-plugin-kong-declarative-config');
    plugins.ignorePlugin('insomnia-plugin-kong-kubernetes-config');
    plugins.ignorePlugin('insomnia-plugin-kong-portal');
    const res = await send(requestId, environmentId);
    const headersObj: Record<string, string> = {};

    for (const h of res.headers || []) {
      const name = h.name || '';
      headersObj[name.toLowerCase()] = h.value || '';
    }

    const bodyBuffer = await getBodyBuffer(res) as Buffer;
    return {
      status: res.statusCode,
      statusMessage: res.statusMessage,
      data: bodyBuffer ? bodyBuffer.toString('utf8') : undefined,
      headers: headersObj,
      responseTime: res.elapsedTime,
    };
  } finally {
    plugins.clearIgnores();
  }
}
