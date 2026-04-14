import aws4 from 'aws4';
import clone from 'clone';

import type { RequestAuthentication } from '~/insomnia-data';

import { CONTENT_TYPE_FORM_DATA } from '../common/constants';
import {
  getContentTypeHeader,
  getHostHeader,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
} from '../common/misc';
import { DEFAULT_BOUNDARY } from './multipart-constants';

const DISABLE_HEADER_VALUE = '__Di$aB13d__';

interface Input {
  req: Req;
  finalUrl?: string;
  requestBody?: string;
  requestBodyPath?: string;
  authHeader?: { name: string; value: string };
}

interface Req {
  headers: any;
  method?: string;
  body: { mimeType?: string | null };
  authentication: {} | RequestAuthentication;
}

export const parseHeaderStrings = ({ req, finalUrl, requestBody, requestBodyPath, authHeader }: Input) => {
  const headers = clone(req.headers);

  if (requestBody !== undefined || requestBodyPath) {
    headers.push(
      { name: 'Expect', value: DISABLE_HEADER_VALUE },
      { name: 'Transfer-Encoding', value: DISABLE_HEADER_VALUE },
    );
  }

  const { authentication, method = 'GET' } = req;
  if (authentication && 'type' in authentication) {
    const isDigest = authentication.type === 'digest';
    const isNTLM = authentication.type === 'ntlm';
    const isAWSIAM = authentication.type === 'iam';
    const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest =
      !hasAuthHeader(headers) && !authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;

    if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest && authHeader) {
      headers.push(authHeader);
    }

    if (isAWSIAM && finalUrl) {
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

  if (req.body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath) {
    const contentTypeHeader = getContentTypeHeader(headers);
    if (contentTypeHeader) {
      contentTypeHeader.value = `multipart/form-data; boundary=${DEFAULT_BOUNDARY}`;
    } else {
      headers.push({ name: 'Content-Type', value: `multipart/form-data; boundary=${DEFAULT_BOUNDARY}` });
    }
  }

  if (!hasAcceptHeader(headers)) {
    headers.push({ name: 'Accept', value: '*/*' });
  }

  if (!hasAcceptEncodingHeader(headers)) {
    headers.push({ name: 'Accept-Encoding', value: DISABLE_HEADER_VALUE });
  }

  if (!hasContentTypeHeader(headers)) {
    headers.push({ name: 'content-type', value: DISABLE_HEADER_VALUE });
  }

  return headers
    .filter((header: any) => header.name)
    .map(({ name, value }: any) =>
      value === '' ? `${name};` : value === DISABLE_HEADER_VALUE ? `${name}:` : `${name}: ${value}`,
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
      host: hostHeader || parsedUrl.host || undefined,
    },
    { accessKeyId, secretAccessKey, sessionToken },
  );

  if (!signature.headers) {
    return [];
  }

  return Object.entries(signature.headers)
    .filter(([name]) => name !== 'content-type')
    .map(([name, value]) => ({ name, value }));
}