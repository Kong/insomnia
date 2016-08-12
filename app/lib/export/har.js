import {DEBOUNCE_MILLIS} from '../constants';
import * as db from '../../database';
import {getRenderedRequest} from '../render';

export function exportHar (requestId) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      db.requestGetById(requestId).then(r => {
        getRenderedRequest(r).then(renderedRequest => {
          resolve({
            method: renderedRequest.method,
            url: renderedRequest.url,
            httpVersion: 'HTTP/1.1',
            cookies: renderedRequest.cookieJar.cookies.map(c => Object.assign(c, {
              name: c.key,
              expires: c.expires && c.expires.toISOString ? c.expires.toISOString() : undefined
            })),
            headers: renderedRequest.headers,
            postData: {
              text: renderedRequest.body
            },
            headersSize: -1,
            bodySize: -1
          });
        })
      })
    }, DEBOUNCE_MILLIS);
  });
}
