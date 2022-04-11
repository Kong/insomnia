import clone from 'clone';

import {
  AUTH_AWS_IAM,
  AUTH_DIGEST,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
} from '../common/constants';
import {
  getContentTypeHeader,
  hasAcceptEncodingHeader,
  hasAcceptHeader,
  hasAuthHeader,
  hasContentTypeHeader,
} from '../common/misc';
import { getAuthHeader } from './authentication';
import { DEFAULT_BOUNDARY } from './multipart';
// Special header value that will prevent the header being sent
const DISABLE_HEADER_VALUE = '__Di$aB13d__';
export const parseHeaderStrings = async ({ renderedRequest, requestBody, requestBodyPath, finalUrl }) => {
  const headers = clone(renderedRequest.headers);

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

  const isDigest = renderedRequest.authentication.type === AUTH_DIGEST;
  const isNTLM = renderedRequest.authentication.type === AUTH_NTLM;
  const isAWSIAM = renderedRequest.authentication.type === AUTH_AWS_IAM;
  if (isAWSIAM) {
    const { authentication } = renderedRequest;
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
      renderedRequest.method,
      authentication.region || '',
      authentication.service || '',
    );

    for (const header of extraHeaders) {
      headers.push(header);
    }
  }
  const hasNoAuthorisationAndNotDisabledAWSBasicOrDigest = !hasAuthHeader(headers) && !renderedRequest.authentication.disabled && !isAWSIAM && !isDigest && !isNTLM;
  if (hasNoAuthorisationAndNotDisabledAWSBasicOrDigest) {
    const authHeader = await getAuthHeader(renderedRequest, finalUrl);

    if (authHeader) {
      headers.push({
        name: authHeader.name,
        value: authHeader.value,
      });
    }
  }
  const isMultipartForm = renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA;
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
