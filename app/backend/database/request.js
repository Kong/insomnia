'use strict';

const {PREVIEW_MODE_SOURCE} = require('../previewModes');
const {METHOD_GET} = require('../constants');
const db = require('./');

module.exports.type = 'Request';
module.exports.prefix = 'req';
module.exports.slug = 'request';
module.exports.init = () => db.initModel({
  url: '',
  name: 'New Request',
  method: METHOD_GET,
  body: '',
  parameters: [],
  headers: [],
  authentication: {},
  metaPreviewMode: PREVIEW_MODE_SOURCE,
  metaResponseFilter: '',
  metaSortKey: -1 * Date.now()
});

module.exports.createAndActivate = (workspace, patch = {}) => {
  return module.exports.requestCreate(patch).then(r => {
    module.exports.workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
};

module.exports.duplicateAndActivate = (workspace, request) => {
  return module.exports.requestDuplicate(request).then(r => {
    module.exports.workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
};

module.exports.create = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return db.docCreate(module.exports.type, patch);
};

module.exports.getById = id => {
  return db.get(module.exports.type, id);
};

module.exports.findByParentId = parentId => {
  return db.find(module.exports.type, {parentId: parentId});
};

module.exports.update = (request, patch) => {
  return db.docUpdate(request, patch);
};

module.exports.updateContentType = (request, contentType) => {
  let headers = [...request.headers];
  const contentTypeHeader = headers.find(
    h => h.name.toLowerCase() === 'content-type'
  );

  if (!contentType) {
    // Remove the contentType header if we are un-setting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = contentType;
  } else {
    headers.push({name: 'Content-Type', value: contentType})
  }

  return db.docUpdate(request, {headers});
};

module.exports.duplicate = request => {
  const name = `${request.name} (Copy)`;
  return db.duplicate(request, {name});
};

module.exports.remove = request => {
  return db.remove(request);
};

module.exports.all = () => {
  return db.all(module.exports.type);
};

module.exports.getAncestors = request => {
  return new Promise(resolve => {
    let ancestors = [];

    const next = (doc) => {
      Promise.all([
        db.requestGroup.getById(doc.parentId),
        db.workspace.getById(doc.parentId)
      ]).then(([requestGroup, workspace]) => {
        if (requestGroup) {
          ancestors = [requestGroup, ...ancestors];
          next(requestGroup);
        } else if (workspace) {
          ancestors = [workspace, ...ancestors];
          next(workspace);
          // We could be done here, but let's have there only be one finish case
        } else {
          // We're finished
          resolve(ancestors);
        }
      });
    };

    next(request);
  });
};

