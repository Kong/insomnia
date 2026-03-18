import type { StainlessSdk } from 'insomnia-api';

import type { HarRequest } from '../../../common/har';
import { tryParseJson } from '../../../common/misc';

export function harToSdkParams(sdk: StainlessSdk, language: string, har: HarRequest) {
  let body: Record<string, unknown> | undefined;
  let bodyWarning: string | undefined;

  if (har.postData) {
    if (har.postData.params) {
      body = Object.fromEntries(har.postData.params.map(({ name, value }) => [name, value ?? '']));
    } else if (har.postData.text) {
      body = tryParseJson(har.postData.text);
      if (body === undefined) {
        bodyWarning = 'Request body could not be represented as a JSON object and was omitted from the snippet generation request.';
      }
    }
  }

  return {
    id: sdk.id,
    language,
    method: har.method,
    path: new URL(har.url).pathname,
    parameters: [
      ...har.queryString.map(({ name, value }) => ({ in: 'query' as const, name, value })),
      ...har.headers.map(({ name, value }) => ({ in: 'header' as const, name, value })),
      ...har.cookies.map(({ name, value }) => ({ in: 'cookie' as const, name, value })),
    ],
    body,
    bodyWarning,
  };
}
