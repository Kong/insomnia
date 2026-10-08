import type { ImportSourceType } from './import';

export interface ParsedDeepLink {
  urlWithoutParams: string;
  params: Record<string, string>;
}

export const parseDeepLinkUrl = (url: string, isDevelopment = false): ParsedDeepLink | null => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.log('[deep-link] Invalid args, expected insomnia://x/y/z', url);
    return null;
  }
  let urlWithoutParams = url.slice(0, Math.max(0, url.indexOf('?'))) || url;
  const params = Object.fromEntries(parsedUrl.searchParams);

  // Normalize the dev protocol so the path matches the production switch cases
  if (isDevelopment) {
    urlWithoutParams = urlWithoutParams.replace('insomniadev://', 'insomnia://');
  }
  return { urlWithoutParams, params };
};

export const sanitizeUrlAndExtractOrigin = (url?: string): string => {
  if (!url) {
    return '';
  }
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};

export interface ImportDeepLinkResource {
  type: ImportSourceType;
  defaultValue: string;
  origin: string;
  endpoint?: string;
  operationId?: string;
}

// Param names double as the source selector: `?curl` selects the cURL tab,
// `?curl=<value>` selects it and pre-populates the input. Only uri/mcp/curl
// can carry a value through the link; clipboard/file are selected bare.
// Selector names are case-insensitive (`?mCp`); metadata params (origin,
// endpoint, operationId, source, sourceUrl) stay case-sensitive.
const DEEP_LINK_SOURCE_ORDER = ['uri', 'mcp', 'curl', 'clipboard', 'file'] as const satisfies readonly ImportSourceType[];

// Case-insensitive lookup of a source-selector param name.
const findSourceParam = (params: Record<string, string>, type: ImportSourceType): string | undefined =>
  Object.keys(params).find(name => name.toLowerCase() === type);

// Value-bearing params win over bare ones, each in the order above;
// endpoint/operationId only apply to uri and curl.
export const resolveImportDeepLink = (params: Record<string, string>): ImportDeepLinkResource | null => {
  const origin = sanitizeUrlAndExtractOrigin(params.origin);
  const endpoint = params.endpoint || undefined;
  const operationId = params.operationId || undefined;

  for (const type of ['uri', 'mcp', 'curl'] as const) {
    const value = params[findSourceParam(params, type) ?? '']?.trim();
    if (!value) {
      continue;
    }
    return {
      type,
      defaultValue: value,
      origin,
      ...(type === 'uri' || type === 'curl' ? { endpoint, operationId } : {}),
    };
  }

  // A bare param (e.g. `insomnia://app/import?clipboard`, or `?curl` with no
  // value) opens the Import modal with that tab selected, nothing pre-populated.
  for (const type of DEEP_LINK_SOURCE_ORDER) {
    if (findSourceParam(params, type) !== undefined) {
      return { type, defaultValue: '', origin };
    }
  }

  return null;
};
