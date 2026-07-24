import fs from 'node:fs';
import nodePath from 'node:path';

import clone from 'clone';
import type { Cookie, RequestHeader, ResponseTimelineEntry } from 'insomnia-data';

import type { RenderedRequest } from '~/common/templating/types';

import type { RequestContext } from '../../../../insomnia-scripting-environment/src/objects';
import { getAuthHeader as getAuthHeaderFromMain } from '../../main/network/get-auth-header';
import type { CurlRequestOptions, CurlRequestOutput, ResponsePatch } from '../../main/network/libcurl-promise';
import { curlRequest } from '../../main/network/libcurl-promise';
import { applyDefaultHeaders } from '../../network/apply-default-headers';
import { addSetCookiesToToughCookieJar } from '../../network/set-cookie-util';
import * as pluginApp from '../../plugins/context/app';
import * as pluginData from '../../plugins/context/data';
import * as pluginNetwork from '../../plugins/context/network';
import * as pluginRequest from '../../plugins/context/request';
import * as pluginResponse from '../../plugins/context/response';
import * as pluginStore from '../../plugins/context/store';
import { runScript as executeScript } from '../../script-executor';

export const getTimelinePath = async (responseId: string): Promise<string> => {
  const electron = require('electron') as { app: { getPath: (name: string) => string } };
  const dataDir = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
  const base = nodePath.resolve(dataDir, 'responses');
  const target = nodePath.resolve(base, responseId + '.timeline');
  const relative = nodePath.relative(base, target);
  if (relative.startsWith('..') || nodePath.isAbsolute(relative)) {
    throw new Error('Invalid response ID');
  }
  return target;
};

export const appendToTimelineOnError = (timelinePath: string, data: string): Promise<void> =>
  fs.promises.appendFile(timelinePath, data);

export const appendTimelineLines = (timelinePath: string, logs: string[]): Promise<void> =>
  fs.promises.appendFile(timelinePath, logs.join('\n'));

export const getAuthHeader = (r: RenderedRequest, u: string): Promise<{ header?: RequestHeader; timeline?: ResponseTimelineEntry[] }> =>
  getAuthHeaderFromMain(r, u);

export const executeCurlRequest = (options: CurlRequestOptions): Promise<CurlRequestOutput> => curlRequest(options);

export async function extractCookies({
  setCookieStrings,
  currentUrl,
  cookieJar,
  settingStoreCookies,
}: {
  setCookieStrings: string[];
  currentUrl: string;
  cookieJar: { cookies: Cookie[] };
  settingStoreCookies: boolean;
}) {
  if (!settingStoreCookies || !setCookieStrings.length) {
    return { cookies: [], rejectedCookies: [], totalSetCookies: 0 };
  }

  const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({
    setCookieStrings,
    currentUrl,
    cookieJar,
  });

  return { cookies, rejectedCookies, totalSetCookies: setCookieStrings.length };
}

export const runScript = (options: {
  script: string;
  context: RequestContext;
}): Promise<RequestContext | { error: string }> => executeScript(options);

export async function applyRequestHooks(
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<RenderedRequest> {
  const newRenderedRequest = applyDefaultHeaders(renderedRequest, renderedContext['DEFAULT_HEADERS']);
  const pluginIndex = await import('../../plugins/index');
  const { services } = await import('insomnia-data');
  // H1: with the sandbox on, a user plugin's hook runs in QuickJS (its `hook` here is a throw-stub
  // from discovery); bundle plugins and the flag-off path run in-process as before.
  // The sandbox host (templating-worker-database) statically imports `electron`, so it can only be
  // reached from an Electron process. This node runtime also backs the pure-Node inso CLI, which has
  // no `electron` — there the sandbox is unavailable, so hooks run in-process as they always have.
  const canSandbox = !!process.type;
  const sandboxEnabled = canSandbox && (await services.settings.get()).templateTagSandboxEnabled;
  // getRequestHooks flattens each plugin's requestHooks in order, so a per-plugin running counter
  // recovers the hook's index within its own array (what the sandbox loads by).
  const hookIndexByPlugin: Record<string, number> = {};
  for (const { plugin, hook } of await pluginIndex.getRequestHooks()) {
    const hookIndex = (hookIndexByPlugin[plugin.name] = (hookIndexByPlugin[plugin.name] ?? -1) + 1);
    try {
      if (sandboxEnabled && plugin.directory !== '') {
        const { runRequestHookInSandbox } = await import('../../main/templating-worker-database');
        const { mergeHookRequestMutation } = await import('../../templating/sandbox/marshal');
        // The hook mutates the request in the sandbox; merge the returned fields back so the next
        // hook (and the send pipeline) sees the mutation, exactly like the in-place path below.
        // Only copies the allowlisted request fields a hook is permitted to touch.
        const mutated = await runRequestHookInSandbox(plugin, hookIndex, newRenderedRequest, renderedContext);
        mergeHookRequestMutation(newRenderedRequest, mutated);
        continue;
      }
      const context = {
        ...(pluginApp.init() as Record<string, any>),
        ...pluginData.init(renderedContext.getProjectId()),
        ...(pluginStore.init(plugin) as Record<string, any>),
        ...(pluginRequest.init(newRenderedRequest, renderedContext) as Record<string, any>),
        ...(pluginNetwork.init() as Record<string, any>),
      };
      await hook(context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as any).plugin = plugin;
      throw error;
    }
  }
  return newRenderedRequest;
}

export async function applyResponseHooks(
  response: ResponsePatch,
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<ResponsePatch> {
  const newResponse = clone(response);
  const newRequest = clone(renderedRequest);
  const pluginIndex = await import('../../plugins/index');
  for (const { plugin, hook } of await pluginIndex.getResponseHooks()) {
    const context = {
      ...(pluginApp.init() as Record<string, any>),
      ...pluginData.init(renderedContext.getProjectId()),
      ...(pluginStore.init(plugin) as Record<string, any>),
      ...(pluginResponse.init(newResponse) as Record<string, any>),
      ...(pluginRequest.init(newRequest, renderedContext, true) as Record<string, any>),
      ...(pluginNetwork.init() as Record<string, any>),
    };
    try {
      await hook(context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as any).plugin = plugin;
      throw error;
    }
  }
  return newResponse;
}
