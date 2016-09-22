'use strict';

const db = require('../index');

module.exports.type = 'Settings';
module.exports.prefix = 'set';
module.exports.slug = 'settings';
module.exports.init = () => db.initModel({
  showPasswords: true,
  useBulkHeaderEditor: false,
  followRedirects: false,
  editorFontSize: 12,
  editorLineWrapping: true,
  httpProxy: '',
  httpsProxy: '',
  timeout: 0,
  validateSSL: true
});

module.exports.create = (patch = {}) => {
  return db.docCreate(module.exports.type, patch);
};

module.exports.update = (settings, patch) => {
  return db.docUpdate(settings, patch);
};

module.exports.getOrCreate = () => {
  return db.all(module.exports.type).then(results => {
    if (results.length === 0) {
      return module.exports.create()
        .then(module.exports.getOrCreate);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
};
