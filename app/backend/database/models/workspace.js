'use strict';

const db = require('../index');
const {DEFAULT_SIDEBAR_WIDTH} = require('../../constants');

module.exports.type = 'Workspace';
module.exports.prefix = 'wrk';
module.exports.slug = 'workspace';
module.exports.init = () => db.initModel({
  name: 'New Workspace',
  metaSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  metaActiveEnvironmentId: null,
  metaActiveRequestId: null,
  metaFilter: '',
  metaSidebarHidden: false
});

module.exports.getById = id => {
  return db.get(module.exports.type, id);
};

module.exports.create = (patch = {}) => {
  return db.docCreate(module.exports.type, patch);
};

module.exports.all = () => {
  return db.all(module.exports.type).then(workspaces => {
    if (workspaces.length === 0) {
      return module.exports.create({name: 'Insomnia'})
        .then(module.exports.all);
    } else {
      return new Promise(resolve => resolve(workspaces))
    }
  });
};

module.exports.count = () => {
  return db.count(module.exports.type)
};

module.exports.update = (workspace, patch) => {
  return db.docUpdate(workspace, patch);
};

module.exports.remove = workspace => {
  return db.remove(workspace);
};
