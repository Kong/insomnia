import {METHOD_GET, getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FILE} from '../common/constants';
import * as db from '../common/database';
import {getContentTypeHeader} from '../common/misc';
import {deconstructToParams} from '../common/querystring';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';

export function init () {
  return {
    url: '',
    name: 'New Request',
    method: METHOD_GET,
    body: {},
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: -1 * Date.now()
  };
}

export function newBodyRaw (rawBody, contentType) {
  if (typeof contentType !== 'string') {
    return {text: rawBody};
  }

  const mimeType = contentType.split(';')[0];
  return {mimeType, text: rawBody};
}

export function newBodyFormUrlEncoded (parameters) {
  // Remove any properties (eg. fileName) that might not fit
  parameters = (parameters || []).map(
    p => ({name: p.name, value: p.value, disabled: !!p.disabled})
  );

  return {
    mimeType: CONTENT_TYPE_FORM_URLENCODED,
    params: parameters
  }
}

export function newBodyFile (path) {
  return {
    mimeType: CONTENT_TYPE_FILE,
    fileName: path
  }
}

export function newBodyForm (parameters) {
  return {
    mimeType: CONTENT_TYPE_FORM_DATA,
    params: parameters
  }
}

export function migrate (doc) {
  doc = migrateBody(doc);
  doc = migrateWeirdUrls(doc);
  return doc;
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

export function updateMimeType (request, mimeType, doCreate = false) {
  let headers = request.headers ? [...request.headers] : [];
  const contentTypeHeader = getContentTypeHeader(headers);

  // 1. Update Content-Type header

  if (!mimeType) {
    // Remove the contentType header if we are un-setting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = mimeType;
  } else {
    headers.push({name: 'Content-Type', value: mimeType})
  }

  // 2. Make a new request body
  // TODO: When switching mime-type, try to convert formats nicely
  let body;
  if (mimeType === request.body.mimeType) {
    body = request.body;
  } else if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    body = newBodyFormUrlEncoded(request.body.params);
  } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
    body = newBodyForm(request.body.params || []);
  } else if (mimeType === CONTENT_TYPE_FILE) {
    body = newBodyFile('');
  } else {
    body = newBodyRaw(request.body.text || '', mimeType);
  }

  if (doCreate) {
    return create(Object.assign({}, request, {headers, body}));
  } else {
    return update(request, {headers, body});
  }
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

// ~~~~~~~~~~ //
// Migrations //
// ~~~~~~~~~~ //

function migrateBody (request) {
  if (request.body && typeof request.body === 'object') {
    return request;
  }

  // Second, convert all existing urlencoded bodies to new format
  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(/^application\/x-www-form-urlencoded/i);

  if (wasFormUrlEncoded) {
    // Convert old-style form-encoded request bodies to new style
    const params = deconstructToParams(request.body, false);
    request.body = newBodyFormUrlEncoded(params);
  } else if (!request.body && !contentType) {
    request.body = {};
  } else {
    request.body = newBodyRaw(request.body, contentType);
  }

  return request;
}

function migrateWeirdUrls (request) {
  // Some people seem to have requests with URLs that don't have the indexOf
  // function. This should clear that up. This can be removed at a later date.

  if (typeof request.url !== 'string') {
    request.url = '';
  }

  return request;
}
