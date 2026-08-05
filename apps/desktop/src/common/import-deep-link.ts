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
  type: Extract<ImportSourceType, 'uri' | 'mcp' | 'curl'>;
  defaultValue: string;
  origin: string;
  endpoint?: string;
  operationId?: string;
}

// Resolution order is uri -> mcp -> curl; endpoint/operationId don't apply to mcp.
export const resolveImportDeepLink = (params: Record<string, string>): ImportDeepLinkResource | null => {
  const origin = sanitizeUrlAndExtractOrigin(params.origin);
  const endpoint = params.endpoint || undefined;
  const operationId = params.operationId || undefined;

  const uri = params.uri?.trim();
  if (uri) {
    return { type: 'uri', defaultValue: uri, origin, endpoint, operationId };
  }

  const mcp = params.mcp?.trim();
  if (mcp) {
    return { type: 'mcp', defaultValue: mcp, origin };
  }

  const curl = params.curl?.trim();
  if (curl) {
    return { type: 'curl', defaultValue: curl, origin, endpoint, operationId };
  }

  return null;
};
