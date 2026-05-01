import type { Request, RequestUrl } from 'curlconverter/dist/src/parse';
import type { DataParam, FileDataParam } from 'curlconverter/dist/src/Request';

import { type RequestAuthentication, services } from '~/insomnia-data';

import { getAppVersion } from '../../../common/constants';
import type { Converter, ImportRequest, Parameter } from '../entities';

export const id = 'curl';
export const name = 'cURL';
export const description = 'cURL command line tool';

const isFileDataParam = (d: DataParam): d is FileDataParam => typeof d === 'object' && d !== null && 'filetype' in d;

const decodeUrlEncoded = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
};

// Drop non-curl `;`-separated commands and rewrite `--d` (ambiguous in curl) to
// `-d` so curlconverter accepts inputs the legacy importer used to handle.
const preprocess = (raw: string) => {
  const collapsed = raw.replace(/\\\r?\n/g, ' ').replace(/\r?\n/g, ' ');
  const commands: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of collapsed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
    } else if (char === quote) {
      quote = null;
    }
    if (char === ';' && quote === null) {
      commands.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  commands.push(current);

  const filtered = commands
    .map(command => command.trim())
    .filter(command => /^\$?\s*curl(\s|;|\\|$)/.test(command))
    .map(command => command.replace(/^\$\s+(curl)/, '$1'))
    .join(';\n');
  return filtered.replace(/(^|\s)--d(\s|=)/g, '$1-d$2');
};

const findExtraCookieValues = (raw: string) => {
  const out: string[] = [];
  // The unquoted alternative `[^;\s]+` deliberately stops at `;` because curl
  // requires the user to quote multi-cookie values that contain `;` (otherwise
  // the shell would split the argument). Multi-cookie unquoted values are not
  // a valid curl invocation, so we don't try to recover them here.
  const re = /(?:^|\s)(?:--cookie|-b)\s+(?:'([^']*)'|"([^"]*)"|([^;\s]+))/g;
  let m: RegExpExecArray | null;
  m = re.exec(raw);
  while (m) {
    const v = m[1] ?? m[2] ?? m[3];
    // A `--cookie` value without `=` is treated as a cookie file path; skip those.
    if (v?.includes('=')) {
      out.push(v);
    }
    m = re.exec(raw);
  }
  return out;
};

const buildHeaders = (req: Request) => {
  const out: { name: string; value: string }[] = [];
  for (const [name, value] of req.headers) {
    if (value === null) {
      continue;
    }
    out.push({ name: name.toString().trim(), value: value.toString() });
  }
  return out;
};

const mergeDroppedCookies = (rawSegment: string, headers: { name: string; value: string }[]) => {
  const existing = headers.find(h => h.name.toLowerCase() === 'cookie');
  if (!existing) {
    return;
  }
  for (const v of findExtraCookieValues(rawSegment)) {
    if (!existing.value.includes(v)) {
      existing.value = existing.value ? `${existing.value}; ${v}` : v;
    }
  }
};

const buildAuth = (
  req: Request,
  headers: { name: string; value: string }[],
): RequestAuthentication | Record<string, never> => {
  const idx = headers.findIndex(
    h => h.name.toLowerCase() === 'authorization' && h.value.trim().toLowerCase().startsWith('bearer'),
  );
  if (idx !== -1) {
    const token = headers[idx].value.trim().slice(7).trim();
    headers.splice(idx, 1);
    return { type: 'bearer', token };
  }
  if (headers.some(h => h.name.toLowerCase() === 'authorization')) {
    return {};
  }
  const auth = req.urls[0]?.auth;
  if (auth) {
    return {
      type: 'basic',
      username: auth[0].toString(),
      password: auth[1].toString(),
    };
  }
  return {};
};

const buildBody = (req: Request, mimeType: string | null) => {
  if (req.multipartUploads?.length) {
    return {
      mimeType: mimeType ?? 'multipart/form-data',
      params: req.multipartUploads.map<Parameter>(p => {
        const param: Parameter = { name: p.name.toString() };
        if ('contentFile' in p && p.contentFile !== undefined) {
          param.fileName = p.contentFile.toString();
          param.type = 'file';
        } else if ('content' in p && p.content !== undefined) {
          param.value = p.content.toString();
          param.type = 'text';
        }
        return param;
      }),
    };
  }

  if (req.dataArray === undefined) {
    return {};
  }

  if (mimeType === 'application/x-www-form-urlencoded') {
    const params: Parameter[] = [];
    for (const d of req.dataArray) {
      if (isFileDataParam(d)) {
        params.push({
          name: d.name?.toString() ?? '',
          fileName: d.filename.toString(),
          type: 'file',
        });
        continue;
      }
      for (const piece of d.toString().split('&')) {
        const eq = piece.indexOf('=');
        if (eq === -1) {
          params.push({ name: '', value: decodeUrlEncoded(piece) });
        } else {
          params.push({
            name: decodeUrlEncoded(piece.slice(0, eq)),
            value: decodeUrlEncoded(piece.slice(eq + 1)),
          });
        }
      }
    }
    // The user supplied a -d/--data-urlencode flag but it parsed to nothing
    // (e.g. `--data-urlencode '='`). Surface a single empty row so the form
    // editor shows the user that a body was intended.
    if (params.length === 0) {
      params.push({ name: '', value: '' });
    }
    return { mimeType, params };
  }

  const text = req.dataArray
    .map(d => (isFileDataParam(d) ? `${d.name ? `${d.name.toString()}=` : ''}@${d.filename.toString()}` : d.toString()))
    .join('&');
  return { mimeType: mimeType ?? '', text };
};

const buildUrlAndParameters = (urlObj: RequestUrl) => {
  const rawUrl = urlObj.urlWithoutQueryArray.toString();
  const parsedUrl = new URL(rawUrl);
  const fromUrl = !!urlObj.urlQueryArray;
  const url = parsedUrl.pathname === '/' && !fromUrl && rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
  const parameters: Parameter[] = [];
  if (urlObj.queryList) {
    for (const [n, v] of urlObj.queryList) {
      const item: Parameter = { name: n.toString(), value: v.toString() };
      if (fromUrl) {
        item.disabled = false;
      }
      parameters.push(item);
    }
  } else {
    // Fallback for query strings that don't round-trip (e.g. `?key` without value).
    const queryStr = urlObj.urlObj.query.toString().replace(/^\?/, '');
    if (queryStr) {
      for (const [n, v] of new URLSearchParams(queryStr)) {
        parameters.push({ name: n, value: v, disabled: false });
      }
    }
  }
  return { url, parameters };
};

const buildRequest = (req: Request, count: number, rawSegment: string): ImportRequest => {
  const headers = buildHeaders(req);
  // prevents curlconverter from adding a Content-Type header if it's not in the raw segment to
  // maintain backward compatibility with several tests
  if (!/content-type/i.test(rawSegment)) {
    const idx = headers.findIndex(h => h.name.toLowerCase() === 'content-type');
    if (idx !== -1) {
      headers.splice(idx, 1);
    }
  }
  mergeDroppedCookies(rawSegment, headers);
  const authentication = buildAuth(req, headers);
  const ct = headers.find(h => h.name.toLowerCase() === 'content-type');
  const mimeType = ct ? ct.value.split(';')[0] : null;
  const body = buildBody(req, mimeType);
  const urlObj = req.urls[0];
  const { url, parameters } = urlObj ? buildUrlAndParameters(urlObj) : { url: '', parameters: [] };
  const method = urlObj?.method.toString().toUpperCase() || ('text' in body || 'params' in body ? 'POST' : 'GET');
  return {
    _id: `__REQ_${count}__`,
    _type: 'request',
    parentId: '__WORKSPACE_ID__',
    name: url || `cURL Import ${count}`,
    parameters,
    url,
    method,
    headers,
    authentication,
    body,
  };
};

const buildEmptyUrlRequest = (raw: string): ImportRequest => {
  const methodMatch = /(?:-X|--request)\s+(['"]?)([A-Za-z]+)\1/.exec(raw);
  return {
    _id: '__REQ_1__',
    _type: 'request',
    parentId: '__WORKSPACE_ID__',
    name: 'cURL Import 1',
    parameters: [],
    url: '',
    method: (methodMatch?.[2] ?? 'POST').toUpperCase(),
    headers: [],
    authentication: {},
    body: {},
  };
};

export const convert: Converter = async rawData => {
  if (!/^\s*\$?\s*curl[\s\\]/.test(rawData)) {
    return null;
  }

  const cleaned = preprocess(rawData);

  // Lazy-load curlconverter so its tree-sitter native module is only
  // initialized when a curl import is actually attempted.
  const { parse } = await import('curlconverter/dist/src/parse');

  let requests: ImportRequest[];
  try {
    const parsedRequests = parse(cleaned);
    // Pair each request with the curl line it came from so we can recover
    // `--cookie` values that curlconverter drops when a Cookie header is also set.
    const segments = cleaned.split(/\r?\n/).filter(l => /^\s*curl(\s|;|\\|$)/.test(l.trim()));
    requests = parsedRequests.map((req, i) => buildRequest(req, i + 1, segments[i] ?? cleaned));
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith('no URL specified')) {
      requests = [buildEmptyUrlRequest(cleaned)];
    } else {
      return { convertErrorMessage: msg };
    }
  }

  const { disableAppVersionUserAgent } = await services.settings.get();
  if (!disableAppVersionUserAgent) {
    const defaultUserAgent = `insomnia/${getAppVersion()}`;
    for (const req of requests) {
      const headers = req.headers ?? [];
      if (!headers.some(header => header.name.toLowerCase() === 'user-agent')) {
        headers.push({ name: 'User-Agent', value: defaultUserAgent });
        req.headers = headers;
      }
    }
  }

  return requests;
};
