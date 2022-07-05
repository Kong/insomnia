import aws4 from 'aws4';
import clone from 'clone';
import { parse as urlParse } from 'url';

import {
  AUTH_AWS_IAM,
  AUTH_DIGEST,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
} from '../../common/constants';
import {
  getContentTypeHeader,
  getHostHeader,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
} from '../../common/misc';
import { DEFAULT_BOUNDARY } from './multipart';

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
  authentication: Record<string, any>;
}
export const parseHeaderStrings = ({ req, finalUrl, requestBody, requestBodyPath, authHeader }: Input) => {
  const headers = clone(req.headers);

  // Disable Expect and Transfer-Encoding headers when we have POST body/file
  const hasRequestBodyOrFilePath = requestBody !== undefined || requestBodyPath;
  if (hasRequestBodyOrFilePath) {
    headers.push({ name: 'Expect', value: DISABLE_HEADER_VALUE });
    headers.push({ name: 'Transfer-Encoding', value: DISABLE_HEADER_VALUE });
  }
  const { authentication, method } = req;
  const isDigest = authentication.type === AUTH_DIGEST;
  const isNTLM = authentication.type === AUTH_NTLM;
  const isAWSIAM = authentication.type === AUTH_AWS_IAM;
  const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest = !hasAuthHeader(headers) && !authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;
  if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest && authHeader) {
    headers.push(authHeader);
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

  return headers.filter((h: any) => h.name)
    .map(({ name, value }: any) =>
      value === '' ? `${name};` // Curl needs a semicolon suffix to send empty header values
        : value === DISABLE_HEADER_VALUE ? `${name}:` // Tell Curl NOT to send the header if value is null
          : `${name}: ${value}`);
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
export function _getAwsAuthHeaders({ authentication, url, method, hostHeader, contentTypeHeader, body }: AWSOptions): { name: string; value: any }[] {
  const { path, host } = urlParse(url);
  const onlyContentTypeHeader = contentTypeHeader ? { 'content-type': contentTypeHeader } : {};
  const { service, region, accessKeyId, secretAccessKey, sessionToken } = authentication;
  const signature = aws4.sign({
    service,
    region,
    body,
    method,
    headers: onlyContentTypeHeader,
    path: path || undefined,
    // AWS uses host header for signing so prioritize that if the user set it manually
    host: hostHeader || host || undefined,
  }, { accessKeyId, secretAccessKey, sessionToken });
  if (!signature.headers) {
    return [];
  }
  return Object.entries(signature.headers)
    .filter(([name]) => name !== 'content-type') // Don't add this because we already have it
    .map(([name, value]) => ({ name, value }));
}
