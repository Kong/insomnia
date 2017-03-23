import {METHOD_GET, getContentTypeFromHeaders, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FILE, AUTH_BASIC, AUTH_OAUTH_2, AUTH_OAUTH_1, AUTH_DIGEST, AUTH_NONE} from '../common/constants';
import * as db from '../common/database';
import {getContentTypeHeader} from '../common/misc';
import {deconstructToParams, buildFromParams} from '../common/querystring';
import {GRANT_TYPE_AUTHORIZATION_CODE} from '../network/o-auth-2/constants';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';
export const canDuplicate = true;

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

export function newAuth (type) {
  switch (type) {
    // HTTP Basic Authentication
    case AUTH_BASIC:
      return {type, username: '', password: ''};

    // OAuth 2.0
    case AUTH_OAUTH_2:
      return {type, grantType: GRANT_TYPE_AUTHORIZATION_CODE};

    // Unimplemented auth types
    case AUTH_OAUTH_1:
    case AUTH_DIGEST:
      return {type};

    // No Auth
    case AUTH_NONE:
    default:
      return {};
  }
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
  parameters = (parameters || []).map(parameter => {
    const newParameter = {
      name: parameter.name,
      value: parameter.value
    };

    if (parameter.hasOwnProperty('id')) {
      newParameter.id = parameter.id;
    }

    if (parameter.hasOwnProperty('disabled')) {
      newParameter.disabled = parameter.disabled;
    } else {
      newParameter.disabled = false;
    }

    return newParameter;
  });

  return {
    mimeType: CONTENT_TYPE_FORM_URLENCODED,
    params: parameters
  };
}

export function newBodyFile (path) {
  return {
    mimeType: CONTENT_TYPE_FILE,
    fileName: path
  };
}

export function newBodyForm (parameters) {
  return {
    mimeType: CONTENT_TYPE_FORM_DATA,
    params: parameters || []
  };
}

export function migrate (doc) {
  doc = migrateBody(doc);
  doc = migrateWeirdUrls(doc);
  doc = migrateAuthType(doc);
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

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 1. Update Content-Type header //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  if (!mimeType) {
    // Remove the contentType header if we are un-setting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = mimeType;
  } else {
    headers.push({name: 'Content-Type', value: mimeType});
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. Make a new request body //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  let body;

  if (mimeType === request.body.mimeType) {
    // Unchanged
    body = request.body;
  } else if (mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    // Urlencoded
    body = request.body.params
      ? newBodyFormUrlEncoded(request.body.params)
      : newBodyFormUrlEncoded(deconstructToParams(request.body.text));
  } else if (mimeType === CONTENT_TYPE_FORM_DATA) {
    // Form Data
    body = request.body.params
      ? newBodyForm(request.body.params)
      : newBodyForm(deconstructToParams(request.body.text));
  } else if (mimeType === CONTENT_TYPE_FILE) {
    // File
    body = newBodyFile('');
  } else if (typeof mimeType !== 'string') {
    // No body
    body = newBodyRaw('');
  } else {
    // Raw Content-Type (ex: application/json)
    body = request.body.params
      ? newBodyRaw(buildFromParams(request.body.params, false), mimeType)
      : newBodyRaw(request.body.text || '', mimeType);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 2. create/update request //
  // ~~~~~~~~~~~~~~~~~~~~~~~~ //

  if (doCreate) {
    return create(Object.assign({}, request, {headers, body}));
  } else {
    return update(request, {headers, body});
  }
}

export async function duplicate (request) {
  const name = `${request.name} (Copy)`;

  // Get sort key of next request
  const q = {metaSortKey: {$gt: request.metaSortKey}};
  const [nextRequest] = await db.find(type, q, {metaSortKey: 1});
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;

  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;

  return db.duplicate(request, {name, metaSortKey});
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

/**
 * Migrate old body (string) to new body (object)
 * @param request
 * @returns {*}
 */
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

/**
 * Fix some weird URLs that were caused by an old bug
 * @param request
 * @returns {*}
 */
function migrateWeirdUrls (request) {
  // Some people seem to have requests with URLs that don't have the indexOf
  // function. This should clear that up. This can be removed at a later date.

  if (typeof request.url !== 'string') {
    request.url = '';
  }

  return request;
}

/**
 * Ensure the request.authentication.type property is added
 * @param request
 * @returns {*}
 */
function migrateAuthType (request) {
  const isAuthSet = request.authentication && request.authentication.username;

  if (isAuthSet && !request.authentication.type) {
    request.authentication.type = AUTH_BASIC;
  }

  return request;
}
