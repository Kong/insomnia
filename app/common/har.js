import * as models from '../models';
import {getRenderedRequest} from './render';
import {jarFromCookies} from './cookies';
import * as util from './misc';
import * as misc from './misc';

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

  // Luckily, Insomnia uses the same body format as HAR :)
  const postData = renderedRequest.body;

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
