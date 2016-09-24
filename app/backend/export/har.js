'use strict';

const db = require('../database');
const {getRenderedRequest} = require('../render');
const {jarFromCookies} = require('../cookies');
const util = require('backend/util');

module.exports.exportHarWithRequest = (renderedRequest, addContentLength = false) => {
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

  return {
    method: renderedRequest.method,
    url: util.prepareUrlForSending(renderedRequest.url),
    httpVersion: 'HTTP/1.1',
    cookies: getCookies(renderedRequest),
    headers: renderedRequest.headers,
    queryString: renderedRequest.parameters,
    postData: {
      text: renderedRequest.body
    },
    headersSize: -1,
    bodySize: -1
  };
};

module.exports.exportHar = (requestId, addContentLength = false) => {
  return db.request.getById(requestId)
    .then(getRenderedRequest)
    .then(renderedRequest => module.exports.exportHarWithRequest(
      renderedRequest,
      addContentLength
    ));
};

function getCookies (renderedRequest) {
  const jar = jarFromCookies(renderedRequest.cookieJar.cookies);
  const domainCookies = jar.getCookies(renderedRequest.url);
  return domainCookies.map(c => Object.assign(c, {
    name: c.key,
    expires: c.expires && c.expires.toISOString ? c.expires.toISOString() : undefined
  }));
}
