'use strict';

const db = require('../index');

module.exports.type = 'Response';
module.exports.prefix = 'res';
module.exports.slug = 'response';
module.exports.init = () => db.initModel({
  statusCode: 0,
  statusMessage: '',
  contentType: 'text/plain',
  url: '',
  bytesRead: 0,
  elapsedTime: 0,
  headers: [],
  cookies: [],
  body: '',
  error: ''
});

module.exports.create = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  db.removeBulkSilently(module.exports.type, {parentId: patch.parentId});
  return db.docCreate(module.exports.type, patch);
};

module.exports.getLatestByParentId = parentId => {
  return db.getMostRecentlyModified(module.exports.type, {parentId});
};
