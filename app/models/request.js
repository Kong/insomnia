import {METHOD_GET, getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA} from '../common/constants';
import * as db from '../common/database';
import {getContentTypeHeader} from '../common/misc';
import {deconstructToParams} from '../common/querystring';
import {CONTENT_TYPE_JSON} from '../common/constants';
import {CONTENT_TYPE_XML} from '../common/constants';
import {CONTENT_TYPE_FILE} from '../common/constants';
import {CONTENT_TYPE_TEXT} from '../common/constants';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';

export function init () {
  return {
    _schema: 1,
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

export function getBodyDescription (body) {
  if (body.fileName) {
    return 'File Upload';
  } else if (body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    return 'Form Url Encoded';
  } else if (body.mimeType === CONTENT_TYPE_FORM_DATA) {
    return 'Form Data';
  } else if (body.mimeType === CONTENT_TYPE_JSON) {
    return 'JSON';
  } else if (body.mimeType === CONTENT_TYPE_XML) {
    return 'XML';
  } else if (body.mimeType === CONTENT_TYPE_TEXT) {
    return 'Plain Text';
  } else {
    return 'Raw Body';
  }
}

export function newBodyRaw (rawBody, contentType) {
  if (!contentType) {
    return {text: rawBody};
  }

  const mimeType = contentType.split(';')[0];
  return {mimeType, text: rawBody};
}

export function newBodyFormUrlEncoded (parameters) {
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
  const schema = doc._schema || 0;

  if (schema <= 0) {
    doc = migrateTo1(doc);
    doc._schema = 1;
  }

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

export function updateMimeType (request, mimeType) {
  let headers = [...request.headers];
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
  if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    request.body = newBodyFormUrlEncoded(request.body.params || []);
  } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
    request.body = newBodyForm(request.body.params || []);
  } else if (mimeType === CONTENT_TYPE_JSON) {
    request.body = newBodyRaw(request.body.text || '');
  } else if (mimeType === CONTENT_TYPE_FILE) {
    request.body = newBodyFile('');
  } else {
    request.body = newBodyRaw(request.body.text || '', mimeType);
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

// ~~~~~~~~~~ //
// Migrations //
// ~~~~~~~~~~ //

function migrateTo1 (request) {

  // Second, convert all existing urlencoded bodies to new format
  const contentType = getContentTypeFromHeaders(request.headers) || '';
  const wasFormUrlEncoded = !!contentType.match(/^application\/x-www-form-urlencoded/i);

  if (wasFormUrlEncoded) {
    // Convert old-style form-encoded request bodies to new style
    const params = deconstructToParams(request.body, false);
    request.body = newBodyFormUrlEncoded(params);
  } else {
    request.body = newBodyRaw(request.body, contentType);
  }

  return request;
}
