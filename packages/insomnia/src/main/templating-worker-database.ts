import fs from 'node:fs';
import os from 'node:os';

import iconv from 'iconv-lite';

import { database as db } from '../common/database';
import * as models from '../models';
import type { Request as DBRequest } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import type { Workspace } from '../models/workspace';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';
export const resolveDbByKey = async (request: Request) => {
  const url = new URL(request.url);
  const body = await request.json();
  // url get normalized to lowercase, so we need to normalize the keys to lower case as well
  const withLowercasedKeys = Object.fromEntries(
    Object.entries(pluginToMainAPI).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const result = await withLowercasedKeys[url.host.toLowerCase()](body);
  return new Response(JSON.stringify(result));
};

// These are exposed to the templating worker and can be used by plugins from context.util
const pluginToMainAPI = {
  'readFile': async (body: { path: string; encoding: 'utf8' }) => {
    return await fs.promises.readFile(body.path, { encoding: body.encoding || 'utf8' });
  },
  'nodeOS': async () => {
    return {
      arch: os.arch(),
      platform: os.platform(),
      release: os.release(),
      cpus: os.cpus(),
      hostname: os.hostname(),
      freemem: os.freemem(),
      userInfo: os.userInfo(),
    };
  },
  'decode': async (body: { buffer: Buffer; encoding: 'utf8' }) => {
    return iconv.decode(body.buffer, body.encoding || 'utf8');
  },
  'request.getById': async (body: { id: string }) => {
    return await models.request.getById(body.id);
  },
  'request.getAncestors': async (body: { request: DBRequest | RequestGroup | Workspace; types: string[] }) => {
    return await db.withAncestors<DBRequest | RequestGroup | Workspace>(body.request, body.types);
  },
  'workspace.getById': async (body: { id: string }) => {
    return await models.workspace.getById(body.id);
  },
  'oAuth2Token.getByRequestId': async (body: { parentId: string }) => {
    return await models.oAuth2Token.getByParentId(body.parentId);
  },
  'cookieJar.getOrCreateForParentId': async (body: { parentId: string }) => {
    return await models.cookieJar.getOrCreateForParentId(body.parentId);
  },
  'response.getLatestForRequestId': async (body: { requestId: string; environmentId: string }) => {
    return await models.response.getLatestForRequest(body.requestId, body.environmentId);
  },
  'response.getBodyBuffer': async (body: { response: Response; readFailureValue: string }) => {
    return await models.response.getBodyBuffer(body.response, body.readFailureValue);
  },
  'pluginData.hasItem': async (body: { pluginName: string; key: string }) => {
    const doc = await models.pluginData.getByKey(body.pluginName, body.key);
    return doc !== null;
  },
  'pluginData.setItem': async (body: { pluginName: string; key: string; value: string }) => {
    return models.pluginData.upsertByKey(body.pluginName, body.key, String(body.value));
  },
  'pluginData.getItem': async (body: { pluginName: string; key: string }) => {
    const doc = await models.pluginData.getByKey(body.pluginName, body.key);
    return doc ? doc.value : null;
  },
  'pluginData.removeItem': async (body: { pluginName: string; key: string }) => {
    return models.pluginData.removeByKey(body.pluginName, body.key);
  },
  'pluginData.clear': async (body: { pluginName: string }) => {
    return models.pluginData.removeAll(body.pluginName);
  },
  'pluginData.all': async (body: { pluginName: string }) => {
    const docs = (await models.pluginData.all(body.pluginName)) || [];
    return docs.map(d => ({
      value: d.value,
      key: d.key,
    }));
  },
  'network.sendRequest': async (body: { request: DBRequest; extraInfo?: { requestChain: string[] } }) => {
    const { request, environment, settings, clientCertificates, caCert, timelinePath, responseId } =
      await fetchRequestData(body.request._id);

    const renderResult = await tryToInterpolateRequest({
      request,
      environment: environment._id,
      purpose: 'send',
      extraInfo: body.extraInfo,
    });
    const response = await sendCurlAndWriteTimeline(
      renderResult.request,
      clientCertificates,
      caCert,
      settings,
      timelinePath,
      responseId,
    );
    return await models.response.create({ ...response, bodyCompression: null }, settings.maxHistoryResponses);
  },
};
