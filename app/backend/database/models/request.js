'use strict';

const {PREVIEW_MODE_SOURCE} = require('../../previewModes');
const {METHOD_GET} = require('../../constants');
const db = require('../index');

const type = 'Request';
const prefix = 'req';
const slug = 'request';

function init () {
  return db.initModel({
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
}

async function createAndActivate (workspace, patch = {}) {
  const r = await create(patch);
  await db.workspace.update(workspace, {metaActiveRequestId: r._id});
  return r;
}

async function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

async function getById (id) {
  return db.get(type, id);
}

async function findByParentId (parentId) {
  return db.find(type, {parentId: parentId});
}

async function update (request, patch) {
  return db.docUpdate(request, patch);
}

async function updateContentType (request, contentType) {
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
}

async function duplicateAndActivate (workspace, request) {
  db.bufferChanges();

  const r = await duplicate(request);
  await db.workspace.update(workspace, {metaActiveRequestId: r._id});

  db.flushChanges();

  return r;
}

async function duplicate (request) {
  const name = `${request.name} (Copy)`;
  return db.duplicate(request, {name})
}

async function remove (request) {
  return db.remove(request);
}

async function all () {
  return db.all(type);
}

async function getAncestors (request) {
  const ancestors = [];

  async function next (doc) {
    const rg = await db.requestGroup.getById(doc.parentId);
    const w = await db.workspace.getById(doc.parentId);

    if (rg) {
      ancestors.unshift(rg);
      return await next(rg);
    } else if (w) {
      ancestors.unshift(w);
      return await next(w);
    } else {
      // We're finished
      return ancestors;
    }
  }

  return await next(request);
}


module.exports = {
  type,
  prefix,
  slug,
  init,
  createAndActivate,
  getById,
  findByParentId,
  update,
  updateContentType,
  duplicateAndActivate,
  duplicate,
  remove,
  all,
  getAncestors
};
