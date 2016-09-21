'use strict';

const db = require('./');

module.exports.type = 'RequestGroup';
module.exports.prefix = 'fld';
module.exports.slug = 'request_group';
module.exports.init = () => db.initModel({
  name: 'New Folder',
  environment: {},
  metaCollapsed: false,
  metaSortKey: -1 * Date.now()
});

module.exports.create = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return db.docCreate(module.exports.type, patch);
};

module.exports.update = (requestGroup, patch) => {
  return db.docUpdate(requestGroup, patch);
};

module.exports.getById = id => {
  return db.get(module.exports.type, id);
};

module.exports.findByParentId = parentId => {
  return db.find(
    module.exports.type,
    {parentId}
  );
};

module.exports.remove = requestGroup => {
  return db.remove(requestGroup);
};

module.exports.all = () => {
  return db.all(module.exports.type);
};

module.exports.duplicate = requestGroup => {
  const name = `${requestGroup.name} (Copy)`;
  return db.duplicate(requestGroup, {name});
};
