import * as db from '../../database';
import {getRenderedRequest} from '../render';
import {jarFromCookies} from '../cookies';

export function exportHar (requestId) {
  return new Promise((resolve, reject) => {
    db.requestGetById(requestId).then(request => {
      return getRenderedRequest(request);
    }).then(renderedRequest => {
      resolve({
        method: renderedRequest.method,
        url: renderedRequest.url,
        httpVersion: 'HTTP/1.1',
        cookies: getCookies(renderedRequest),
        headers: renderedRequest.headers,
        postData: {
          text: renderedRequest.body
        },
        headersSize: -1,
        bodySize: -1
      });
    })
  });
}

function getCookies (renderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookies(renderedRequest.url);
  return domainCookies.map(c => Object.assign(c, {
    name: c.key,
    expires: c.expires && c.expires.toISOString ? c.expires.toISOString() : undefined
  }));
}
