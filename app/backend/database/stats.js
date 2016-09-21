'use strict';

const db = require('./');

module.exports.type = 'Stats';
module.exports.prefix = 'sta';
module.exports.slug = 'stats';
module.exports.init = () => db.initModel({
  lastLaunch: Date.now(),
  lastVersion: null,
  launches: 0
});

module.exports.create = (patch = {}) => {
  return db.docCreate(module.exports.type, patch);
};

module.exports.update = patch => {
  return module.exports.get().then(stats => {
    return db.docUpdate(stats, patch);
  });
};

module.exports.get = () => {
  return db.all(module.exports.type).then(results => {
    if (results.length === 0) {
      return module.exports.create()
        .then(module.exports.get);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
};
