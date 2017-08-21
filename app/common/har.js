import fs from 'fs';
import * as models from '../models';
import {getRenderedRequest} from './render';
import {jarFromCookies} from './cookies';
import * as misc from './misc';
import {newBodyRaw} from '../models/request';
import {getAuthHeader} from '../network/authentication';

export async function exportHarWithRequest (renderedRequest, addContentLength = false) {
  let postData = '';
  const url = misc.prepareUrlForSending(renderedRequest.url);

  if (renderedRequest.body.fileName) {
    try {
      postData = newBodyRaw(fs.readFileSync(renderedRequest.body.fileName, 'base64'));
    } catch (e) {
      console.warn('[code gen] Failed to read file', e);
    }
  } else {
    // For every other type, Insomnia uses the same body format as HAR
    postData = renderedRequest.body;
  }

  if (addContentLength) {
    const hasContentLengthHeader = misc.filterHeaders(
        renderedRequest.headers,
        'content-length'
      ).length > 0;

    if (!hasContentLengthHeader) {
      const name = 'content-length';
      const value = Buffer.byteLength((renderedRequest.body || {}).text || '').toString();
      renderedRequest.headers.push({name, value});
    }
  }

  // Set auth header if we have it
  if (!misc.hasAuthHeader(renderedRequest.headers)) {
    const header = await getAuthHeader(
      renderedRequest._id,
      url,
      renderedRequest.method,
      renderedRequest.authentication
    );
    header && renderedRequest.headers.push(header);
  }

  return {
    method: renderedRequest.method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: getCookies(renderedRequest),
    headers: renderedRequest.headers,
    queryString: renderedRequest.parameters,
    postData: postData,
    headersSize: -1,
    bodySize: -1
  };
}

export async function exportHar (requestId, environmentId, addContentLength = false) {
  const request = await models.request.getById(requestId);
  const renderedRequest = await getRenderedRequest(request, environmentId);
  return await exportHarWithRequest(renderedRequest, addContentLength);
}

function getCookies (renderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookiesSync(renderedRequest.url);
  return domainCookies.map(c => Object.assign(c.toJSON(), {
    name: c.key,
    value: c.value || '' // Sometimes cookies don't have values for some reason
  }));
}
