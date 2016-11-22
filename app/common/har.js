import fs from 'fs';
import * as models from '../models';
import {getRenderedRequest} from './render';
import {jarFromCookies} from './cookies';
import * as util from './misc';
import * as misc from './misc';
import {CONTENT_TYPE_FILE} from './constants';
import {newBodyRaw} from '../models/request';

export function exportHarWithRequest (renderedRequest, addContentLength = false) {
  if (addContentLength) {
    const hasContentLengthHeader = misc.filterHeaders(
        renderedRequest.headers,
        'content-length'
      ).length > 0;

    if (!hasContentLengthHeader) {
      const name = 'content-length';
      const value = Buffer.byteLength(body).toString();
      renderedRequest.headers.push({name, value})
    }
  }

  let postData = '';
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

  return {
    method: renderedRequest.method,
    url: util.prepareUrlForSending(renderedRequest.url),
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
  return exportHarWithRequest(renderedRequest, addContentLength);
}

function getCookies (renderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookiesSync(renderedRequest.url);
  return domainCookies.map(c => Object.assign(c.toJSON(), {
    name: c.key
  }));
}
