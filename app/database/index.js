import electron from 'electron';
import NeDB from 'nedb';
import * as fsPath from 'path';
import * as methods from '../lib/constants';
import {DB_PERSIST_INTERVAL, DEFAULT_SIDEBAR_WIDTH} from '../lib/constants';
import {generateId} from './util';
import {PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {isDevelopment} from '../lib/appInfo';

export const TYPE_STATS = 'Stats';
export const TYPE_SETTINGS = 'Settings';
export const TYPE_WORKSPACE = 'Workspace';
export const TYPE_ENVIRONMENT = 'Environment';
export const TYPE_COOKIE_JAR = 'CookieJar';
export const TYPE_REQUEST_GROUP = 'RequestGroup';
export const TYPE_REQUEST = 'Request';
export const TYPE_RESPONSE = 'Response';


const BASE_MODEL_DEFAULTS = () => ({
  modified: Date.now(),
  created: Date.now(),
  parentId: null
});

const MODEL_DEFAULTS = {
  [TYPE_STATS]: () => ({
    lastLaunch: Date.now(),
    lastVersion: null,
    launches: 0
  }),
  [TYPE_SETTINGS]: () => ({
    showPasswords: true,
    useBulkHeaderEditor: false,
    followRedirects: false,
    editorFontSize: 12,
    editorLineWrapping: true,
    httpProxy: '',
    httpsProxy: '',
    timeout: 0,
    validateSSL: true
  }),
  [TYPE_WORKSPACE]: () => ({
    name: 'New Workspace',
    metaSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    metaActiveEnvironmentId: null,
    metaActiveRequestId: null,
    metaFilter: ''
  }),
  [TYPE_ENVIRONMENT]: () => ({
    name: 'New Environment',
    data: {},
  }),
  [TYPE_COOKIE_JAR]: () => ({
    name: 'Default Jar',
    cookies: []
  }),
  [TYPE_REQUEST_GROUP]: () => ({
    name: 'New Folder',
    environment: {},
    metaCollapsed: false,
    metaSortKey: -1 * Date.now()
  }),
  [TYPE_REQUEST]: () => ({
    url: '',
    name: 'New Request',
    method: methods.METHOD_GET,
    body: '',
    parameters: [],
    headers: [],
    authentication: {},
    metaPreviewMode: PREVIEW_MODE_SOURCE,
    metaSortKey: -1 * Date.now()
  }),
  [TYPE_RESPONSE]: () => ({
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    url: '',
    bytesRead: 0,
    elapsedTime: 0,
    headers: [],
    cookies: [],
    body: '',
    error: ''
  }),
};

export const ALL_TYPES = Object.keys(MODEL_DEFAULTS);

let db = null;

function getDBFilePath (modelType) {
  // NOTE: Do not EVER change this. EVER!
  const basePath = electron.remote.app.getPath('userData');
  return fsPath.join(basePath, `insomnia.${modelType}.db`);
}

/**
 * Initialize the database. This should be called once on app start.
 * @returns {Promise}
 */
let initialized = false;
export function initDB () {
  // Only init once
  if (initialized) {
    return new Promise(resolve => resolve());
  }

  return new Promise(resolve => {
    db = {};

    if (isDevelopment()) {
      global.db = db;
    }

    // Fill in the defaults

    const modelTypes = Object.keys(MODEL_DEFAULTS);
    modelTypes.map(t => {
      const filename = getDBFilePath(t);
      const autoload = true;
      const inMemoryOnly = process.env.INSOMNIA_ENV === 'test';

      db[t] = new NeDB({
        inMemoryOnly,
        filename,
        autoload
      });
      db[t].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL)
    });

    // Done

    initialized = true;
    console.log(`-- Initialize DB at ${getDBFilePath('t')} --`);
    resolve();
  });
}

let changeListeners = {};

export function onChange (id, callback) {
  console.log(`-- Added DB Listener ${id} -- `);
  changeListeners[id] = callback;
}

export function offChange (id) {
  console.log(`-- Removed DB Listener ${id} -- `);
  delete changeListeners[id];
}

function getMostRecentlyModified (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].find(query).sort({modified: -1}).limit(1).exec((err, docs) => {
      resolve(docs.length ? docs[0] : null);
    })
  })
}

function find (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      const modelDefaults = MODEL_DEFAULTS[type]();
      const docs = rawDocs.map(rawDoc => {
        return Object.assign({}, modelDefaults, rawDoc);
      });

      resolve(docs);
    });
  });
}

function all (type) {
  return find(type);
}

function getWhere (type, query) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      if (rawDocs.length === 0) {
        // Not found. Too bad!
        return resolve(null);
      }

      const modelDefaults = MODEL_DEFAULTS[type]();
      resolve(Object.assign({}, modelDefaults, rawDocs[0]));
    });
  });
}

function get (type, id) {
  return getWhere(type, {_id: id});
}

function count (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
}

function insert (doc) {
  return new Promise((resolve, reject) => {
    db[doc.type].insert(doc, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      resolve(newDoc);
      Object.keys(changeListeners).map(k => changeListeners[k]('insert', doc));
    });
  });
}

function update (doc) {
  return new Promise((resolve, reject) => {
    db[doc.type].update({_id: doc._id}, doc, err => {
      if (err) {
        return reject(err);
      }

      resolve(doc);
      Object.keys(changeListeners).map(k => changeListeners[k]('update', doc));
    });
  });
}

function remove (doc) {
  return new Promise(resolve => {
    withChildren(doc).then(docs => {
      const promises = docs.map(d => (
        db[d.type].remove({_id: d._id}, {multi: true})
      ));

      Promise.all(promises).then(() => {
        for (const doc of docs) {
          Object.keys(changeListeners).map(k => changeListeners[k]('remove', doc));
        }
        resolve()
      });
    });
  });
}

/**
 * Remove a lot of documents quickly and silently
 *
 * @param type
 * @param query
 * @returns {Promise.<T>}
 */
function removeBulkSilently (type, query) {
  return new Promise(resolve => {
    db[type].remove(query, {multi: true}, err => resolve());
  });
}


// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

function docUpdate (originalDoc, patch = {}) {
  const doc = Object.assign(
    BASE_MODEL_DEFAULTS(),
    originalDoc,
    patch,
    {modified: Date.now()}
  );

  return update(doc);
}

function docCreate (type, idPrefix, patch = {}) {
  const doc = Object.assign(
    BASE_MODEL_DEFAULTS(),
    {_id: generateId(idPrefix)},
    MODEL_DEFAULTS[type](),
    patch,

    // Fields that the user can't touch
    {
      type: type,
      modified: Date.now()
    }
  );

  return insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

export function withChildren (doc = null) {
  let docsToReturn = doc ? [doc] : [];

  const next = (docs) => {
    const promises = [];
    for (const doc of docs) {
      for (const type of ALL_TYPES) {
        // If the doc is null, we want to search for parentId === null
        const parentId = doc ? doc._id : null;
        promises.push(find(type, {parentId}));
      }
    }

    return Promise.all(promises).then(results => {
      let newDocs = [];

      // Gather up the docs from each type
      for (const docs of results) {
        for (const doc of docs) {
          newDocs.push(doc);
        }
      }

      if (newDocs.length === 0) {
        // Didn't find anything. We're done
        return new Promise(resolve => resolve(docsToReturn));
      }

      // Continue searching for children
      docsToReturn = [...docsToReturn, ...newDocs];
      return next(newDocs);
    });
  };

  return next([doc]);
}


// ~~~~~~~ //
// REQUEST //
// ~~~~~~~ //

export function requestCreateAndActivate (workspace, patch = {}) {
  return requestCreate(patch).then(r => {
    workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
}

export function requestCopyAndActivate (workspace, request) {
  return requestDuplicate(request).then(r => {
    workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
}

export function requestCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(TYPE_REQUEST, 'req', patch);
}

export function requestGetById (id) {
  return get(TYPE_REQUEST, id);
}

export function requestFindByParentId (parentId) {
  return find(TYPE_REQUEST, {parentId: parentId});
}

export function requestUpdate (request, patch) {
  return docUpdate(request, patch);
}

export function requestUpdateContentType (request, contentType) {
  let headers = [...request.headers];
  const contentTypeHeader = headers.find(
    h => h.name.toLowerCase() === 'content-type'
  );

  if (!contentType) {
    // Remove the contentType header if we are unsetting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = contentType;
  } else {
    headers.push({name: 'Content-Type', value: contentType})
  }

  return docUpdate(request, {headers});
}

export function requestDuplicate (request) {
  const name = `${request.name} (Copy)`;
  const newRequest = Object.assign({}, request, {name});

  // Remove the old Id
  delete newRequest._id;

  return requestCreate(newRequest);
}

export function requestRemove (request) {
  return remove(request);
}

export function requestAll () {
  return all(TYPE_REQUEST);
}

export function requestGetAncestors (request) {
  return new Promise(resolve => {
    let ancestors = [];

    const next = (doc) => {
      Promise.all([
        requestGroupGetById(doc.parentId),
        workspaceGetById(doc.parentId)
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
}


// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

export function requestGroupCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(TYPE_REQUEST_GROUP, 'fdr', patch);
}

export function requestGroupUpdate (requestGroup, patch) {
  return docUpdate(requestGroup, patch);
}

export function requestGroupGetById (id) {
  return get(TYPE_REQUEST_GROUP, id);
}

export function requestGroupFindByParentId (parentId) {
  return find(TYPE_REQUEST_GROUP, {parentId});
}

export function requestGroupRemove (requestGroup) {
  return remove(requestGroup);
}

export function requestGroupAll () {
  return all(TYPE_REQUEST_GROUP);
}


// ~~~~~~~~ //
// RESPONSE //
// ~~~~~~~~ //

export function responseCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  removeBulkSilently(TYPE_RESPONSE, {parentId: patch.parentId});
  return docCreate(TYPE_RESPONSE, 'res', patch);
}

export function responseAll () {
  return all(TYPE_RESPONSE);
}

export function responseGetLatestByParentId (parentId) {
  return getMostRecentlyModified(TYPE_RESPONSE, {parentId});
}


// ~~~~~~~ //
// COOKIES //
// ~~~~~~~ //

export function cookieJarCreate (patch = {}) {
  return docCreate(TYPE_COOKIE_JAR, 'jar', patch);
}

export function cookieJarGetOrCreateForWorkspace (workspace) {
  const parentId = workspace._id;
  return find(TYPE_COOKIE_JAR, {parentId}).then(cookieJars => {
    if (cookieJars.length === 0) {
      return cookieJarCreate({parentId})
    } else {
      return new Promise(resolve => resolve(cookieJars[0]));
    }
  });
}

export function cookieJarAll () {
  return all(TYPE_COOKIE_JAR);
}

export function cookieJarGetById (id) {
  return get(TYPE_COOKIE_JAR, id);
}

export function cookieJarUpdate (cookieJar, patch) {
  return docUpdate(cookieJar, patch);
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function workspaceGetById (id) {
  return get(TYPE_WORKSPACE, id);
}

export function workspaceCreate (patch = {}) {
  return docCreate(TYPE_WORKSPACE, 'wrk', patch);
}

export function workspaceAll () {
  return all(TYPE_WORKSPACE).then(workspaces => {
    if (workspaces.length === 0) {
      return workspaceCreate({name: 'Insomnia'}).then(workspaceAll);
    } else {
      return new Promise(resolve => resolve(workspaces))
    }
  });
}

export function workspaceCount () {
  return count(TYPE_WORKSPACE)
}

export function workspaceUpdate (workspace, patch) {
  return docUpdate(workspace, patch);
}

export function workspaceRemove (workspace) {
  return remove(workspace);
}


// ~~~~~~~~~~~ //
// ENVIRONMENT //
// ~~~~~~~~~~~ //

export function environmentCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Environment missing `parentId`', patch);
  }

  return docCreate(TYPE_ENVIRONMENT, 'env', patch);
}

export function environmentUpdate (environment, patch) {
  return docUpdate(environment, patch);
}

export function environmentFindByParentId (parentId) {
  return find(TYPE_ENVIRONMENT, {parentId});
}

export function environmentGetOrCreateForWorkspace (workspace) {
  const parentId = workspace._id;
  return find(TYPE_ENVIRONMENT, {parentId}).then(environments => {
    if (environments.length === 0) {
      return environmentCreate({parentId, name: 'Base Environment'})
    } else {
      return new Promise(resolve => resolve(environments[0]));
    }
  });
}

export function environmentGetById (id) {
  return get(TYPE_ENVIRONMENT, id);
}

export function environmentRemove (environment) {
  return remove(environment);
}

export function environmentAll () {
  return all(TYPE_ENVIRONMENT);
}


// ~~~~~~~~ //
// SETTINGS //
// ~~~~~~~~ //

export function settingsCreate (patch = {}) {
  return docCreate(TYPE_SETTINGS, 'set', patch);
}

export function settingsUpdate (settings, patch) {
  return docUpdate(settings, patch);
}

export function settingsGet () {
  return all(TYPE_SETTINGS).then(results => {
    if (results.length === 0) {
      return settingsCreate().then(settingsGet);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
}

// ~~~~~ //
// STATS //
// ~~~~~ //

export function statsCreate (patch = {}) {
  return docCreate(TYPE_STATS, 'sta', patch);
}

export function statsUpdate (patch) {
  return statsGet().then(stats => {
    return docUpdate(stats, patch);
  });
}

export function statsGet () {
  return all(TYPE_STATS).then(results => {
    if (results.length === 0) {
      return statsCreate().then(statsGet);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
}
