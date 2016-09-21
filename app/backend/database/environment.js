'use strict';

const db = require('./');

module.exports.type = 'Environment';
module.exports.prefix = 'env';
module.exports.slug = 'environment';
module.exports.init = () => db.initModel({
  name: 'New Environment',
  data: {},
});

module.exports.create = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Environment missing `parentId`', patch);
  }

  return db.docCreate(module.exports.type, patch);
};

module.exports.update = (environment, patch) => {
  return db.docUpdate(environment, patch);
};

module.exports.findByParentId = parentId => {
  return db.find(module.exports.type, {parentId});
};

module.exports.getOrCreateForWorkspace = workspace => {
  const parentId = workspace._id;
  return db.find(module.exports.type, {parentId}).then(environments => {
    if (environments.length === 0) {
      return module.exports.create({
        parentId,
        name: 'Base Environment'
      })
    } else {
      return new Promise(resolve => resolve(environments[0]));
    }
  });
};

module.exports.getById = id => {
  return db.get(module.exports.type, id);
};

module.exports.remove = environment => {
  return db.remove(environment);
};

module.exports.all = () => {
  return db.all(module.exports.type);
};
