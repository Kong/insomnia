import { stat, writeFile } from 'fs/promises';
import mkdirp from 'mkdirp';
import os from 'os';

import { version } from '../../package.json';
import { BaseModel, types as modelTypes } from '../models';
import * as models from '../models';
import { getBodyBuffer } from '../models/response';
import { Settings } from '../models/settings';
import caCerts from '../network/ca_certs';
import { send } from '../network/network';
import * as plugins from '../plugins';
import { database } from './database';

// The network layer uses settings from the settings model
// We want to give consumers the ability to override certain settings
type SettingsOverride = Pick<Settings, 'validateSSL'>;

export async function getSendRequestCallbackMemDb(environmentId: string, memDB: any, settingsOverrides?: SettingsOverride) {
  const baseCAPath = path.join(os.tmpdir(), `insomnia_${version}`);
  const fullCAPath = path.join(baseCAPath, 'ca-certs.pem');
  try {
    await stat(fullCAPath);
  } catch {
    mkdirp.sync(baseCAPath);
    await writeFile(fullCAPath, String(caCerts));
  }
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
