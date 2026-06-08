import type { Cookie, RequestHeader } from 'insomnia-data';

import type { RequestContext } from '../../../../insomnia-scripting-environment/src/objects';
import type { CurlRequestOptions, CurlRequestOutput, ResponsePatch } from '../../main/network/libcurl-promise';
import type { RenderedRequest } from '../../templating/types';

interface CurlRequestErrorOutput {
  statusMessage: string;
  error: string;
}

export interface NetworkRuntime {
  getTimelinePath: (responseId: string) => Promise<string>;
  appendToTimelineOnError: (timelinePath: string, data: string) => Promise<void>;
  appendTimelineLines: (timelinePath: string, logs: string[]) => Promise<void>;
  getAuthHeader: (request: RenderedRequest, url: string) => Promise<RequestHeader | undefined>;
  executeCurlRequest: (options: CurlRequestOptions) => Promise<CurlRequestOutput | CurlRequestErrorOutput>;
  extractCookies: (options: {
    setCookieStrings: string[];
    currentUrl: string;
    cookieJar: { cookies: Cookie[] };
    settingStoreCookies: boolean;
  }) => Promise<{ cookies: Cookie[]; rejectedCookies: string[]; totalSetCookies: number }>;
  runScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext | { error: string }>;
  applyRequestHooks: (
    renderedRequest: RenderedRequest,
    renderedContext: Record<string, any>,
  ) => Promise<RenderedRequest>;
  applyResponseHooks: (
    response: ResponsePatch,
    renderedRequest: RenderedRequest,
    renderedContext: Record<string, any>,
  ) => Promise<ResponsePatch>;
}

export interface RuntimeCapabilities {
  network: NetworkRuntime;
}
