import {AUTH_BASIC, AUTH_DIGEST, AUTH_NONE, AUTH_NTLM, AUTH_OAUTH_2, AUTH_AWS_IAM, CONTENT_TYPE_FILE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_OTHER, getContentTypeFromHeaders, METHOD_GET} from '../common/constants';
import * as db from '../common/database';
import {getContentTypeHeader} from '../common/misc';
import {buildFromParams, deconstructToParams} from '../common/querystring';
import {GRANT_TYPE_AUTHORIZATION_CODE} from '../network/o-auth-2/constants';

export const name = 'Request';
export const type = 'Request';
export const prefix = 'req';
export const canDuplicate = true;

export function init () {
  return {
    url: '',
    name: 'New Request',
    description: '',
    method: METHOD_GET,
    body: {},
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: -1 * Date.now(),

    // Settings
    settingStoreCookies: true,
    settingSendCookies: true,
    settingDisableRenderRequestBody: false,
    settingEncodeUrl: true
  };
}

export function newAuth (type, oldAuth = {}) {
  switch (type) {
    // No Auth
    case AUTH_NONE:
      return {};

    // HTTP Basic Authentication
    case AUTH_BASIC:
    case AUTH_DIGEST:
    case AUTH_NTLM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || ''
      };

    // OAuth 2.0
    case AUTH_OAUTH_2:
      return {type, grantType: GRANT_TYPE_AUTHORIZATION_CODE};

    case AUTH_AWS_IAM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || ''
      };

    // Types needing no defaults
    default:
      return {type};
  }
}

export function newBodyNone () {
  return {};
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

  // Check if we are converting to/from variants of XML or JSON
  let leaveContentTypeAlone = false;
  if (contentTypeHeader && mimeType) {
    const current = contentTypeHeader.value;
    if (current.includes('xml') && mimeType.includes('xml')) {
      leaveContentTypeAlone = true;
    } else if (current.includes('json') && mimeType.includes('json')) {
      leaveContentTypeAlone = true;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // 1. Update Content-Type header //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const hasBody = typeof mimeType === 'string';
  if (!hasBody || mimeType === CONTENT_TYPE_OTHER) {
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (mimeType && contentTypeHeader && !leaveContentTypeAlone) {
    contentTypeHeader.value = mimeType;
  } else if (mimeType && !contentTypeHeader) {
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
    body = newBodyNone();
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
