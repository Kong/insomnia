import type { BinaryToTextEncoding } from 'node:crypto';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

import { shell } from 'electron';
import iconv from 'iconv-lite';
import { v4 as uuidv4 } from 'uuid';

import { getAppBundlePlugins, RESPONSE_CODE_REASONS } from '../common/constants';
import { database as db } from '../common/database';
import * as models from '../models';
import type { CloudProviderCredential } from '../models/cloud-credential';
import type { Request as DBRequest } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Response } from '../models/response';
import { readCurlResponse } from '../models/response';
import type { Workspace } from '../models/workspace';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';
import { getPluginCommonContext, type Plugin, type TemplateTag } from '../plugins';
import type { PluginTemplateTag, PluginTemplateTagContext, PluginToMainAPIPaths } from '../templating/types';
import { curlRequest } from './network/libcurl-promise';

const bundlePluginModuleMap: Record<string, Plugin['module']> = {};

export const resolveDbByKey = async (request: Request) => {
  const url = new URL(request.url);
  let body;
  try {
    // We expect this to throw if a db call returns undefined
    body = await request.json();
  } catch {}
  // url get normalized to lowercase, so we need to normalize the keys to lower case as well
  const withLowercasedKeys = Object.fromEntries(
    Object.entries(pluginToMainAPI).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const urlHostLowerCase = url.host.toLowerCase();
  try {
    const result = await withLowercasedKeys[urlHostLowerCase](body);
    return new Response(JSON.stringify(result));
  } catch (err) {
    console.error(`Error resolving db by key ${urlHostLowerCase}:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

const getBundlePluginModule = (pluginName: string): Plugin['module'] => {
  if (pluginName in Object.keys(bundlePluginModuleMap)) {
    return bundlePluginModuleMap[pluginName];
  }
  try {
    const module = require(pluginName) as Plugin['module'];
    bundlePluginModuleMap[pluginName] = module;
    return module;
  } catch (err) {
    console.error(`Failed to load bundled plugin ${pluginName}`, err);
  }
  return {};
};

// These are exposed to the templating worker and can be used by plugins from context.util
const pluginToMainAPI: Record<PluginToMainAPIPaths, (...args: any[]) => Promise<any>> = {
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
  'encode': async (body: { input: string; encoding: BinaryToTextEncoding }) => {
    return crypto.createHash('md5').update(body.input).digest(body.encoding);
  },
  'request.getById': async (body: { id: string }) => {
    return await models.request.getById(body.id);
  },
  'request.getAncestors': async (body: { request: DBRequest | RequestGroup | Workspace; types: models.AllTypes[] }) => {
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
    return await models.response.getLatestForRequestId(body.requestId, body.environmentId);
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
  'cloudCredential.getById': async (body: { id: string }) => {
    return await models.cloudCredential.getById(body.id);
  },
  'cloudCredential.update': async (body: {
    originCredential: CloudProviderCredential;
    patch: Partial<CloudProviderCredential>;
  }) => {
    return await models.cloudCredential.update(body.originCredential, body.patch);
  },
  'settings.get': async () => {
    return await models.settings.get();
  },
  'openInBrowser': async (body: { url: string }) => {
    const { url } = body;
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') {
      return shell.openExternal(url);
    }
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
  // use libcurl to send request without side effects(do not write to database about request and response)
  'network.sendRequestWithoutSideEffects': async (body: {
    options: {
      request: Pick<DBRequest, 'url' | 'method' | 'headers'> & Partial<Pick<DBRequest, 'body' | 'authentication'>>;
      caCertficatePath: string;
    };
  }) => {
    const requestId = uuidv4();
    const settings = await models.settings.get();
    const settingFollowRedirects = settings?.followRedirects ? 'on' : 'off';
    const { request: originRequest, caCertficatePath = null } = body.options;
    const response = await curlRequest({
      requestId: `no-sideEffects-request-${requestId}`,
      req: {
        authentication: { type: 'none' },
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
    const result = {
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
    return new Response(JSON.stringify(result));
  },
  // used to generate the template tags for the bundle plugins and send back to the web worker
  'plugin.getBundlePluginTemplateTags': async () => {
    const appBundlePlugins = getAppBundlePlugins();
    const appBundlePluginTemplateTags: TemplateTag[] = [];
    appBundlePlugins.forEach(p => {
      const { name: pluginName } = p;
      try {
        const module = getBundlePluginModule(pluginName);
        const pluginExportedTemplateTags: PluginTemplateTag[] = module?.templateTags || [];
        const pluginTemplateTags: TemplateTag[] = pluginExportedTemplateTags.map(tt => ({
          plugin: {
            name: pluginName,
            description: 'Bundle plugin',
            version: 'Unknown',
            directory: '',
            config: {
              disabled: false,
            },
            module,
          },
          templateTag: tt,
        }));
        appBundlePluginTemplateTags.push(...pluginTemplateTags);
      } catch (err) {
        console.error(`[plugin] Failed to load bundled plugin ${pluginName}`, err);
      }
    });
    return appBundlePluginTemplateTags;
  },
  // execute the plugin tag with the given parameters
  'plugin.executeBundlePluginTag': async (body: {
    args: any[];
    pluginName: string;
    tagName: string;
    context: Pick<PluginTemplateTagContext, 'meta' | 'renderPurpose' | 'context'>;
  }) => {
    const { tagName, pluginName, args, context: originContext } = body;
    const { meta, renderPurpose, context } = originContext;
    const appBundlePluginNames = getAppBundlePlugins().map(p => p.name);
    if (appBundlePluginNames.includes(pluginName)) {
      const module = getBundlePluginModule(pluginName);
      const templateTags = module?.templateTags || [];
      const targetTag = templateTags.find(tag => tag.name === tagName);
      if (targetTag) {
        const commonContext = getPluginCommonContext({ plugin: { name: pluginName } });
        // @ts-expect-error -- TSCONVERSION: Bundle plugin tag context do not have node functions in utils
        return targetTag.run({ meta, renderPurpose, context, ...commonContext }, ...args);
      }
    }
    throw new Error(`Unsupported tag ${tagName} for plugin ${pluginName}`);
  },
};
