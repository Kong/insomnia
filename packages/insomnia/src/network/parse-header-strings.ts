import aws4 from 'aws4';
import clone from 'clone';
import { parse as urlParse } from 'url';

import {
  AUTH_AWS_IAM,
  AUTH_DIGEST,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
} from '../common/constants';
import {
  getContentTypeHeader,
  getHostHeader,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
} from '../common/misc';
import { RequestHeader } from '../models/request';
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
  const hasRequestBodyOrFilePath = requestBody || requestBodyPath;
  if (hasRequestBodyOrFilePath) {
    headers.push({
      name: 'Expect',
      value: DISABLE_HEADER_VALUE,
    });
    headers.push({
      name: 'Transfer-Encoding',
      value: DISABLE_HEADER_VALUE,
    });
  }
  const { authentication, method } = req;
  const isDigest = authentication.type === AUTH_DIGEST;
  const isNTLM = authentication.type === AUTH_NTLM;
  const isAWSIAM = authentication.type === AUTH_AWS_IAM;
  if (isAWSIAM) {
    const credentials = {
      accessKeyId: authentication.accessKeyId || '',
      secretAccessKey: authentication.secretAccessKey || '',
      sessionToken: authentication.sessionToken || '',
    };

    const extraHeaders = _getAwsAuthHeaders(
      credentials,
      headers,
      requestBody || '',
      finalUrl,
      method,
      authentication.region || '',
      authentication.service || '',
    );

    for (const header of extraHeaders) {
      headers.push(header);
    }
  }
  const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest = !hasAuthHeader(headers) && !authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;
  if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest) {
    if (authHeader) {
      headers.push({
        name: authHeader.name,
        value: authHeader.value,
      });
    }
  }
  const isMultipartForm = req.body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (isMultipartForm && requestBodyPath) {
    const contentTypeHeader = getContentTypeHeader(headers);
    if (contentTypeHeader) contentTypeHeader.value = `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`;
    else headers.push({
      name: 'Content-Type',
      value: `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`,
    });
  }
  // Send a default Accept headers of anything
  if (!hasAcceptHeader(headers)) {
    headers.push({
      name: 'Accept',
      value: '*/*',
    }); // Default to anything
  }

  // Don't auto-send Accept-Encoding header
  if (!hasAcceptEncodingHeader(headers)) {
    headers.push({
      name: 'Accept-Encoding',
      value: DISABLE_HEADER_VALUE,
    });
  }

  // Prevent curl from adding default content-type header
  if (!hasContentTypeHeader(headers)) {
    headers.push({
      name: 'content-type',
      value: DISABLE_HEADER_VALUE,
    });
  }

  return headers
    .filter(h => h.name)
    .map(h => {
      const value = h.value || '';

      if (value === '') {
        // Curl needs a semicolon suffix to send empty header values
        return `${h.name};`;
      } else if (value === DISABLE_HEADER_VALUE) {
        // Tell Curl NOT to send the header if value is null
        return `${h.name}:`;
      } else {
        // Send normal header value
        return `${h.name}: ${value}`;
      }
    });
};
// exported for unit tests only
export function _getAwsAuthHeaders(
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  },
  headers: RequestHeader[],
  body: string,
  url: string,
  method: string,
  region?: string,
  service?: string,
): {
  name: string;
  value: string;
}[] {
  const parsedUrl = urlParse(url);
  const contentTypeHeader = getContentTypeHeader(headers);
  // AWS uses host header for signing so prioritize that if the user set it manually
  const hostHeader = getHostHeader(headers);
  const host = hostHeader ? hostHeader.value : parsedUrl.host;
  const awsSignOptions: aws4.Request = {
    service,
    region,
    ...(host ? { host } : {}),
    body,
    method,
    ...(parsedUrl.path ? { path: parsedUrl.path } : {}),
    headers: contentTypeHeader ? { 'content-type': contentTypeHeader.value } : {},
  };
  const signature = aws4.sign(awsSignOptions, credentials);
  if (!signature.headers) {
    return [];
  }
  return Object.keys(signature.headers)
    .filter(name => name !== 'content-type') // Don't add this because we already have it
    .map(name => ({
      name,
      value: String(signature.headers?.[name]),
    }));
}
