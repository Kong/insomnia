import clone from 'clone';

import { filterHeaders } from '~/common/misc';
import type { RequestHeader } from '~/insomnia-data';
import { plugins as pluginsBridge } from '~/plugins/renderer-bridge';
import type { RenderedRequest } from '~/templating/types';

import type { RequestContext } from '../../../insomnia-scripting-environment/src/objects';
import type { CurlRequestOptions, ResponsePatch } from '../main/network/libcurl-promise';
import { cancellableCurlRequest } from './cancellation';
import { runScriptConcurrently } from './concurrency';

export const getTimelinePath = (responseId: string): Promise<string> => window.main.timeline.getPath(responseId);

export const appendToTimelineOnError = (timelinePath: string, data: string): Promise<void> =>
  window.main.timeline.appendToFile({ timelinePath, data });

export const appendTimelineLines = (timelinePath: string, logs: string[]): Promise<void> =>
  window.main.timeline.appendToFile({ timelinePath, data: logs.join('\n') });

export const getAuthHeader = (r: RenderedRequest, u: string): Promise<RequestHeader | undefined> =>
  window.main.getAuthHeader(r, u);

export const executeCurlRequest = (options: CurlRequestOptions) => cancellableCurlRequest(options);

export const runScript = (options: {
  script: string;
  context: RequestContext;
}): Promise<RequestContext | { error: string }> => runScriptConcurrently(options);

export async function applyRequestHooks(
  newRenderedRequest: RenderedRequest,
  renderedContext: Record<string, any>,
): Promise<RenderedRequest> {
  const request = clone(newRenderedRequest);
  const defaultHeaders = renderedContext['DEFAULT_HEADERS'];
  if (defaultHeaders && typeof defaultHeaders === 'object' && !Array.isArray(defaultHeaders)) {
    for (const name of Object.keys(defaultHeaders)) {
      const value = (defaultHeaders as Record<string, any>)[name];
      const existing = filterHeaders(request.headers, name);
      if (existing.length) {
        console.log(`[header] Skip setting default header ${name}. Already set to ${value}`);
      } else if (value === 'null') {
        const toRemove = filterHeaders(request.headers, name);
        request.headers = request.headers.filter(h => !toRemove.includes(h));
        console.log(`[header] Remove default header ${name}`);
      } else {
        request.headers.push({ name, value: String(value) });
        console.log(`[header] Set default header ${name}: ${value}`);
      }
    }
  }
  if (!(await pluginsBridge.hasRequestHooks())) {
    return request;
  }
  return pluginsBridge.applyRequestHooks({
    renderedRequest: request,
    projectId: renderedContext.getProjectId(),
    environment: renderedContext,
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
    environment: renderedContext,
  });
}
