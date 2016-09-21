'use strict';

const db = require('../database');
const {getRenderedRequest} = require('../render');
const {jarFromCookies} = require('../cookies');

module.exports.exportHar = (requestId, addContentLength = false) => {
  return new Promise((resolve, reject) => {
    db.requestGetById(requestId).then(request => {
      return getRenderedRequest(request);
    }).then(renderedRequest => {

      if (addContentLength) {
        const hasContentLengthHeader = !!renderedRequest.headers.find(
          h => h.name.toLowerCase() === 'content-length'
        );

        if (!hasContentLengthHeader) {
          const name = 'content-length';
          const value = Buffer.byteLength(renderedRequest.body).toString();
          renderedRequest.headers.push({name, value})
        }
      }

      resolve({
        method: renderedRequest.method,
        url: renderedRequest.url,
        httpVersion: 'HTTP/1.1',
        cookies: getCookies(renderedRequest),
        headers: renderedRequest.headers,
        queryString: renderedRequest.parameters,
        postData: {
          text: renderedRequest.body
        },
        headersSize: -1,
        bodySize: -1
      });
    })
  });
};

function getCookies (renderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookies(renderedRequest.url);
  return domainCookies.map(c => Object.assign(c, {
    name: c.key,
    expires: c.expires && c.expires.toISOString ? c.expires.toISOString() : undefined
  }));
}
