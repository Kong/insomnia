'use strict';

const db = require('./');

module.exports.type = 'CookieJar';
module.exports.prefix = 'jar';
module.exports.slug = 'cookie_jar';
module.exports.init = () => db.initModel({
  name: 'Default Jar',
  cookies: []
});

module.exports.create = (patch = {}) => {
  return db.docCreate(module.exports.type, patch);
};

module.exports.getOrCreateForWorkspace = workspace => {
  const parentId = workspace._id;
  return db.find(module.exports.type, {parentId}).then(cookieJars => {
    if (cookieJars.length === 0) {
      return module.exports.create({parentId})
    } else {
      return new Promise(resolve => resolve(cookieJars[0]));
    }
  });
};

module.exports.all = () => {
  return db.all(module.exports.type);
};

module.exports.getById = id => {
  return db.get(module.exports.type, id);
};

module.exports.update = (cookieJar, patch) => {
  return db.docUpdate(cookieJar, patch);
};
