import {METHOD_GET, PREVIEW_MODE_SOURCE} from '../common/constants';
import * as db from '../common/database';
import * as misc from '../common/misc';
import {getContentTypeHeader} from '../common/misc';

export const type = 'Request';
export const prefix = 'req';

export function init () {
  return {
    url: '',
    name: 'New Request',
    method: METHOD_GET,
    body: '',
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: -1 * Date.now()
  };
}

export function create (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return db.docCreate(type, patch);
}

export function getById (id) {
  return db.get(type, id);
}

export function findByParentId (parentId) {
  return db.find(type, {parentId: parentId});
}

export function update (request, patch) {
  return db.docUpdate(request, patch);
}

export function updateContentType (request, contentType) {
  let headers = [...request.headers];
  const contentTypeHeader = getContentTypeHeader(headers);

  if (!contentType) {
    // Remove the contentType header if we are un-setting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = contentType;
  } else {
    headers.push({name: 'Content-Type', value: contentType})
  }

  return update(request, {headers});
}

export function duplicate (request) {
  const name = `${request.name} (Copy)`;
  const metaSortKey = request.metaSortKey + 1;
  return db.duplicate(request, {name, metaSortKey})
}

export function remove (request) {
  return db.remove(request);
}

export function all () {
  return db.all(type);
}
