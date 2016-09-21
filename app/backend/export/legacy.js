'use strict';

const db = require('../database/index');
const {getContentTypeFromHeaders} = require('../contentTypes');

const FORMAT_MAP = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  text: 'text/plain'
};

module.exports.importRequestGroupLegacy = (importedRequestGroup, parentId, index = 1) => {
  return db.requestGroup.create({
    parentId,
    name: importedRequestGroup.name,
    environment: (importedRequestGroup.environments || {}).base || {},
    metaCollapsed: true,
    metaSortKey: index * 1000
  }).then(requestGroup => {
    // Sometimes (maybe all the time, I can't remember) requests will be nested
    if (importedRequestGroup.hasOwnProperty('requests')) {
      // Let's process them oldest to newest
      importedRequestGroup.requests.map(
        (r, i) => module.exports.importRequestLegacy(r, requestGroup._id, index * 1000 + i)
      );
    }
  });
};

module.exports.importRequestLegacy = (importedRequest, parentId, index = 1) => {
  let auth = {};
  if (importedRequest.authentication.username) {
    auth = {
      username: importedRequest.authentication.username,
      password: importedRequest.authentication.password
    }
  }

  // Add the content type header
  const headers = importedRequest.headers || [];
  const contentType = getContentTypeFromHeaders(headers);
  if (!contentType) {
    const derivedContentType = FORMAT_MAP[importedRequest.__insomnia.format];

    if (derivedContentType) {
      headers.push({
        name: 'Content-Type',
        value: FORMAT_MAP[importedRequest.__insomnia.format]
      });
    }
  }

  db.request.create({
    parentId,
    _id: importedRequest._id,
    name: importedRequest.name,
    url: importedRequest.url,
    method: importedRequest.method,
    body: importedRequest.body,
    headers: headers,
    parameters: importedRequest.params || [],
    metaSortKey: index * 1000,
    contentType: FORMAT_MAP[importedRequest.__insomnia.format] || 'text/plain',
    authentication: auth
  });
};

