import aws4 from 'aws4';
import clone from 'clone';
import type { RequestAuthentication } from 'insomnia-data';

import { CONTENT_TYPE_FORM_DATA } from '~/common/constants';
import {
  getContentTypeHeader,
  getHostHeader,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
} from '~/common/misc';

import { DEFAULT_BOUNDARY } from './multipart-constants';

// Special header value that will prevent the header being sent
const DISABLE_HEADER_VALUE = '__Di$aB13d__';
interface Input {
  req: Req;
  finalUrl: string;
  requestBody?: string;
  requestBodyPath?: string;
  authHeader?: { name: string; value: string };
}

interface Req {
  headers: any;
  method: string;
  body: { mimeType?: string | null };
  authentication: {} | RequestAuthentication;
  settingSendCookies?: boolean;
}

export const getCookieHeaderValue = (headers: any[], authHeader?: { name: string; value: string }) => {
  return [...headers, ...(authHeader ? [authHeader] : [])]
    .filter(header => String(header?.name ?? '').toLowerCase() === 'cookie')
    .map(header => String(header?.value ?? '').trim())
    .filter(Boolean)
    .join('; ');
};

export const parseHeaderStrings = ({ req, finalUrl, requestBody, requestBodyPath, authHeader }: Input) => {
  // libcurl builds the Cookie header from its cookie engine and appends any cookie string it
  // is given to that same header. A user-authored Cookie header kept here would be sent as a
  // second Cookie header, and servers only read the first one.
  const sendCookies = req.settingSendCookies === true;
  const isCookieHeader = (header: any) => String(header?.name ?? '').toLowerCase() === 'cookie';
  const headers = clone(req.headers).filter((header: any) => !sendCookies || !isCookieHeader(header));
  const authHeaderToSend = sendCookies && isCookieHeader(authHeader) ? undefined : authHeader;

  // Disable Expect and Transfer-Encoding headers when we have POST body/file
  const hasRequestBodyOrFilePath = requestBody !== undefined || requestBodyPath;
  if (hasRequestBodyOrFilePath) {
    headers.push(
      { name: 'Expect', value: DISABLE_HEADER_VALUE },
      { name: 'Transfer-Encoding', value: DISABLE_HEADER_VALUE },
    );
  }

  const { authentication, method } = req;
  if (authentication && 'type' in authentication) {
    const isDigest = authentication.type === 'digest';
    const isNTLM = authentication.type === 'ntlm';
    const isAWSIAM = authentication.type === 'iam';
    const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest =
      !hasAuthHeader(headers) && !authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;
    if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest && authHeaderToSend) {
      headers.push(authHeaderToSend);
    }
    if (isAWSIAM) {
      const hostHeader = getHostHeader(headers)?.value;
      const contentTypeHeader = getContentTypeHeader(headers)?.value;
      _getAwsAuthHeaders({
        authentication,
        url: finalUrl,
        hostHeader,
        contentTypeHeader,
        body: requestBody,
        method,
      }).forEach(header => headers.push(header));
    }
  }
  const isMultipartForm = req.body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (isMultipartForm && requestBodyPath) {
    const contentTypeHeader = getContentTypeHeader(headers);
    if (contentTypeHeader) {
      contentTypeHeader.value = `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`;
    } else {
      headers.push({ name: 'Content-Type', value: `multipart/form-data; boundary=${DEFAULT_BOUNDARY}` });
    }
  }
  // Send a default Accept headers of anything
  if (!hasAcceptHeader(headers)) {
    headers.push({ name: 'Accept', value: '*/*' }); // Default to anything
  }

  // Don't auto-send Accept-Encoding header
  if (!hasAcceptEncodingHeader(headers)) {
    headers.push({ name: 'Accept-Encoding', value: DISABLE_HEADER_VALUE });
  }

  // Prevent curl from adding default content-type header
  if (!hasContentTypeHeader(headers)) {
    headers.push({ name: 'content-type', value: DISABLE_HEADER_VALUE });
  }

  return headers
    .filter((h: any) => h.name)
    .map(({ name, value }: any) =>
      value === ''
        ? `${name};` // Curl needs a semicolon suffix to send empty header values
        : value === DISABLE_HEADER_VALUE
          ? `${name}:` // Tell Curl NOT to send the header if value is null
          : `${name}: ${value}`,
    );
};

interface AWSOptions {
  authentication: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    service?: string;
  };
  url: string;
  method: string;
  hostHeader?: string;
  contentTypeHeader?: string;
  body?: string;
}

export function _getAwsAuthHeaders({
  authentication,
  url,
  method,
  hostHeader,
  contentTypeHeader,
  body,
}: AWSOptions): { name: string; value: any }[] {
  const parsedUrl = new URL(url);
  const onlyContentTypeHeader = contentTypeHeader ? { 'content-type': contentTypeHeader } : {};
  const { service, region, accessKeyId, secretAccessKey, sessionToken } = authentication;
  const signature = aws4.sign(
    {
      service,
      region,
      body,
      method,
      headers: onlyContentTypeHeader,
      path: `${parsedUrl.pathname}${parsedUrl.search}` || undefined,
      // AWS uses host header for signing so prioritize that if the user set it manually
      host: hostHeader || parsedUrl.host || undefined,
    },
    { accessKeyId, secretAccessKey, sessionToken },
  );

  if (!signature.headers) {
    return [];
  }

  return Object.entries(signature.headers)
    .filter(([name]) => name !== 'content-type') // Don't add this because we already have it
    .map(([name, value]) => ({ name, value }));
}
