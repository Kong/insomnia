import { v4 as uuidv4 } from 'uuid';

import { RESPONSE_CODE_REASONS } from '../common/constants';
import { database as db } from '../common/database';
import * as models from '../models';
import type { Request as DBRequest } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import { readCurlResponse } from '../models/response';
import type { Workspace } from '../models/workspace';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';
import { curlRequest } from './network/libcurl-promise';

export const resolveDbByKey = async (request: Request) => {
  const url = new URL(request.url);
  let result;
  const body = await request.json();
  if (url.host === 'request.getById'.toLowerCase()) {
    result = await models.request.getById(body.id);
  }
  if (url.host === 'request.getAncestors'.toLowerCase()) {
    result = await db.withAncestors<DBRequest | RequestGroup | Workspace>(body.request, body.types);
  }
  if (url.host === 'workspace.getById'.toLowerCase()) {
    result = await models.workspace.getById(body.id);
  }
  if (url.host === 'oAuth2Token.getByRequestId'.toLowerCase()) {
    result = await models.oAuth2Token.getByParentId(body.parentId);
  }
  if (url.host === 'cookieJar.getOrCreateForParentId'.toLowerCase()) {
    result = await models.cookieJar.getOrCreateForParentId(body.parentId);
  }
  if (url.host === 'cloudCredential.getById'.toLowerCase()) {
    result = await models.cloudCredential.getById(body.id);
  }
  if (url.host === 'cloudCredential.update'.toLowerCase()) {
    result = await models.cloudCredential.update(body.originCredential, body.patch);
  }
  if (url.host === 'response.getLatestForRequestId'.toLowerCase()) {
    result = await models.response.getLatestForRequest(body.requestId, body.environmentId);
  }
  if (url.host === 'response.getBodyBuffer'.toLowerCase()) {
    result = await models.response.getBodyBuffer(body.response, body.readFailureValue);
  }
  if (url.host === 'settings.getSettings'.toLowerCase()) {
    result = await models.settings.get();
  }
  if (url.host === 'pluginData.hasItem'.toLowerCase()) {
    const doc = await models.pluginData.getByKey(body.pluginName, body.key);
    result = doc !== null;
  }
  if (url.host === 'pluginData.setItem'.toLowerCase()) {
    result = models.pluginData.upsertByKey(body.pluginName, body.key, String(body.value));
  }
  if (url.host === 'pluginData.getItem'.toLowerCase()) {
    const doc = await models.pluginData.getByKey(body.pluginName, body.key);
    result = doc ? doc.value : null;
  }
  if (url.host === 'pluginData.removeItem'.toLowerCase()) {
    result = models.pluginData.removeByKey(body.pluginName, body.key);
  }
  if (url.host === 'pluginData.clear'.toLowerCase()) {
    result = models.pluginData.removeAll(body.pluginName);
  }
  if (url.host === 'pluginData.all'.toLowerCase()) {
    const docs = (await models.pluginData.all(body.pluginName)) || [];
    result = docs.map(d => ({
      value: d.value,
      key: d.key,
    }));
  }
  if (url.host === 'network.sendRequest'.toLowerCase()) {
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
    result = await models.response.create({ ...response, bodyCompression: null }, settings.maxHistoryResponses);
  }

  if (url.host === 'network.nodeCurlRequest'.toLowerCase()) {
    const requestId = uuidv4();
    const settings = await models.settings.get();
    const settingFollowRedirects = settings?.followRedirects ? 'on' : 'off';
    const { request: originRequest, caCertficatePath = null } = body.options;
    const response = await curlRequest({
      requestId: `cloud-service-integration-${requestId}`,
      req: {
        authentication: {},
        body: {},
        cookieJar: {
          cookies: [],
        },
        cookies: [],
        suppressUserAgent: false,
        settingFollowRedirects,
        settingRebuildPath: true,
        settingSendCookies: true,
        ...originRequest,
      },
      finalUrl: originRequest.url,
      settings,
      certificates: [],
      caCertficatePath,
    });
    const { headerResults, patch, responseBodyPath } = response;
    if (patch.error) {
      throw new Error(patch.error);
    }
    if (headerResults.length === 0) {
      throw new Error('Error in response: no header result is found');
    }
    const lastRedirect = headerResults[headerResults.length - 1];
    if (!lastRedirect) {
      throw new Error('Error in response: the lastRedirect is not defined');
    }
    const bodyResult = await readCurlResponse({
      bodyPath: responseBodyPath,
      bodyCompression: patch.bodyCompression,
    });

    result = {
      code: lastRedirect.code,
      reason: lastRedirect.reason,
      headers: lastRedirect.headers,
      responseTime: patch.elapsedTime,
      body: bodyResult.body,
      ok: lastRedirect.code >= 200 && lastRedirect.code < 300,
      status: lastRedirect.reason || RESPONSE_CODE_REASONS[lastRedirect.code] || 'Unknown',
      json: () => {
        try {
          return JSON.parse(bodyResult.body);
        } catch (error) {
          throw new Error(`Error parsing JSON response: ${error}`);
        }
      },
    };
  }

  return new Response(JSON.stringify(result));
};
