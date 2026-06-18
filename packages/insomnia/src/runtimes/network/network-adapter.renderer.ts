import type { Cookie, RequestHeader } from 'insomnia-data';

import { serializeRenderContext } from '~/common/templating/render-context-serialization';
import type { RenderedRequest } from '~/common/templating/types';
import { plugins as pluginsBridge } from '~/ui/plugins/renderer-bridge';

import type { RequestContext } from '../../../../insomnia-scripting-environment/src/objects';
import type { CurlRequestOptions, ResponsePatch } from '../../main/network/libcurl-promise';
import { applyDefaultHeaders } from '../../network/apply-default-headers';
import { cancellableCurlRequest } from '../../network/cancellation.renderer';
import { runScriptConcurrently } from '../../network/concurrency.renderer';

export const getTimelinePath = (responseId: string): Promise<string> => window.main.timeline.getPath(responseId);

export const appendToTimelineOnError = (timelinePath: string, data: string): Promise<void> =>
  window.main.timeline.appendToFile({ timelinePath, data });

export const appendTimelineLines = (timelinePath: string, logs: string[]): Promise<void> =>
  window.main.timeline.appendToFile({ timelinePath, data: logs.join('\n') });

export const getAuthHeader = (r: RenderedRequest, u: string): Promise<RequestHeader | undefined> =>
  window.main.getAuthHeader(r, u);

export const executeCurlRequest = (options: CurlRequestOptions) => cancellableCurlRequest(options);

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

  const { cookies, rejectedCookies } = await window.main.cookies.addSetCookies({
    setCookieStrings,
    currentUrl,
    cookieJar: cookieJar.cookies,
  });

  return { cookies, rejectedCookies, totalSetCookies: setCookieStrings.length };
}

export const runScript = (options: {
  script: string;
  context: RequestContext;
}): Promise<RequestContext | { error: string }> => runScriptConcurrently(options);

export async function applyRequestHooks(
  newRenderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<RenderedRequest> {
  const request = applyDefaultHeaders(newRenderedRequest, renderedContext['DEFAULT_HEADERS']);
  if (!(await pluginsBridge.hasRequestHooks())) {
    return request;
  }
  return pluginsBridge.applyRequestHooks({
    renderedRequest: request,
    projectId: renderedContext.getProjectId(),
    // Functions on the render context cannot be structured-cloned over IPC to the plugin window.
    environment: serializeRenderContext(renderedContext),
  });
}

export async function applyResponseHooks(
  response: ResponsePatch,
  renderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<ResponsePatch> {
  if (!(await pluginsBridge.hasResponseHooks())) {
    return response;
  }
  return pluginsBridge.applyResponseHooks({
    response,
    renderedRequest,
    projectId: renderedContext.getProjectId(),
    // Functions on the render context cannot be structured-cloned over IPC to the plugin window.
    environment: serializeRenderContext(renderedContext),
  });
}
