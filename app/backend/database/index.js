'use strict';

const electron = require('electron');
const NeDB = require('nedb');
const fsPath = require('path');
const {
  METHOD_GET,
  DB_PERSIST_INTERVAL,
  DEFAULT_SIDEBAR_WIDTH
} = require('../constants');
const {generateId} = require('../util');
const {PREVIEW_MODE_SOURCE} = require('../previewModes');
const {isDevelopment} = require('../appInfo');

module.exports.TYPE_STATS = 'Stats';
module.exports.TYPE_SETTINGS = 'Settings';
module.exports.TYPE_WORKSPACE = 'Workspace';
module.exports.TYPE_ENVIRONMENT = 'Environment';
module.exports.TYPE_COOKIE_JAR = 'CookieJar';
module.exports.TYPE_REQUEST_GROUP = 'RequestGroup';
module.exports.TYPE_REQUEST = 'Request';
module.exports.TYPE_RESPONSE = 'Response';

module.exports.CHANGE_INSERT = 'insert';
module.exports.CHANGE_UPDATE = 'update';
module.exports.CHANGE_REMOVE = 'remove';


const BASE_MODEL_DEFAULTS = () => ({
  modified: Date.now(),
  created: Date.now(),
  parentId: null
});

const MODEL_ID_PREFIXES = {
  [module.exports.TYPE_STATS]: 'sta',
  [module.exports.TYPE_SETTINGS]: 'set',
  [module.exports.TYPE_WORKSPACE]: 'wrk',
  [module.exports.TYPE_ENVIRONMENT]: 'env',
  [module.exports.TYPE_COOKIE_JAR]: 'jar',
  [module.exports.TYPE_REQUEST_GROUP]: 'fld',
  [module.exports.TYPE_REQUEST]: 'req',
  [module.exports.TYPE_RESPONSE]: 'res'
};

module.exports.MODEL_DEFAULTS = {
  [module.exports.TYPE_STATS]: () => ({
    lastLaunch: Date.now(),
    lastVersion: null,
    launches: 0
  }),
  [module.exports.TYPE_SETTINGS]: () => ({
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
  [module.exports.TYPE_WORKSPACE]: () => ({
    name: 'New Workspace',
    metaSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    metaActiveEnvironmentId: null,
    metaActiveRequestId: null,
    metaFilter: '',
    metaSidebarHidden: false
  }),
  [module.exports.TYPE_ENVIRONMENT]: () => ({
    name: 'New Environment',
    data: {},
  }),
  [module.exports.TYPE_COOKIE_JAR]: () => ({
    name: 'Default Jar',
    cookies: []
  }),
  [module.exports.TYPE_REQUEST_GROUP]: () => ({
    name: 'New Folder',
    environment: {},
    metaCollapsed: false,
    metaSortKey: -1 * Date.now()
  }),
  [module.exports.TYPE_REQUEST]: () => ({
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
  }),
  [module.exports.TYPE_RESPONSE]: () => ({
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

module.exports.ALL_TYPES = Object.keys(module.exports.MODEL_DEFAULTS);

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
module.exports.initDB = (config = {}, force = false) => {
  // Only init once
  if (initialized && !force) {
    return Promise.resolve();
  }

  console.log('CONFIG', config);

  return new Promise(resolve => {
    db = {};

    if (isDevelopment()) {
      global.db = db;
    }

    // Fill in the defaults

    const modelTypes = Object.keys(module.exports.MODEL_DEFAULTS);
    modelTypes.map(t => {
      const filename = getDBFilePath(t);
      const autoload = true;
      const finalConfig = Object.assign({filename, autoload}, config);

      db[t] = new NeDB(finalConfig);
      db[t].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL)
    });

    // Done

    initialized = true;
    console.log(`-- Initialize DB at ${getDBFilePath('t')} --`);
    resolve();
  });
};

let changeListeners = {};

module.exports.onChange = (id, callback) => {
  console.log(`-- Added DB Listener ${id} -- `);
  changeListeners[id] = callback;
};

module.exports.offChange = (id) => {
  console.log(`-- Removed DB Listener ${id} -- `);
  delete changeListeners[id];
};

function notifyOfChange (event, doc) {
  Object.keys(changeListeners).map(k => changeListeners[k](event, doc));
}

function getMostRecentlyModified (type, query = {}) {
  return new Promise(resolve => {
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

      const modelDefaults = module.exports.MODEL_DEFAULTS[type]();
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

      const modelDefaults = module.exports.MODEL_DEFAULTS[type]();
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

module.exports.insert = doc => {
  return new Promise((resolve, reject) => {
    db[doc.type].insert(doc, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      resolve(newDoc);
      notifyOfChange(module.exports.CHANGE_INSERT, doc);
    });
  });
};

function update (doc) {
  return new Promise((resolve, reject) => {
    db[doc.type].update({_id: doc._id}, doc, err => {
      if (err) {
        return reject(err);
      }

      resolve(doc);
      notifyOfChange(module.exports.CHANGE_UPDATE, doc);
    });
  });
}

function remove (doc) {
  return new Promise(resolve => {
    module.exports.withDescendants(doc).then(docs => {
      const promises = docs.map(d => (
        db[d.type].remove({_id: d._id}, {multi: true})
      ));

      Promise.all(promises).then(() => {
        docs.map(d => notifyOfChange(module.exports.CHANGE_REMOVE, d));
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

function docCreate (type, patch = {}) {
  const idPrefix = MODEL_ID_PREFIXES[type];

  if (!idPrefix) {
    throw new Error(`No ID prefix for ${type}`)
  }

  const doc = Object.assign(
    BASE_MODEL_DEFAULTS(),
    {_id: generateId(idPrefix)},
    module.exports.MODEL_DEFAULTS[type](),
    patch,

    // Fields that the user can't touch
    {
      type: type,
      modified: Date.now()
    }
  );

  return module.exports.insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

module.exports.withDescendants = (doc = null) => {
  let docsToReturn = doc ? [doc] : [];

  const next = (docs) => {
    const promises = [];
    for (const doc of docs) {
      for (const type of module.exports.ALL_TYPES) {
        // If the doc is null, we want to search for parentId === null
        const parentId = doc ? doc._id : null;
        promises.push(find(type, {parentId}));
      }
    }

    return Promise.all(promises).then(results => {
      let newDocs = [];

      // Gather up the docs = require(each type
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
};

module.exports.duplicate = (originalDoc, patch = {}) => {
  return new Promise((resolve, reject) => {

    // 1. Copy the doc
    const newDoc = Object.assign({}, originalDoc, patch);
    delete newDoc._id;
    delete newDoc.created;
    delete newDoc.modified;

    docCreate(newDoc.type, newDoc).then(createdDoc => {

      // 2. Get all the children
      const promises = [];
      for (const type of module.exports.ALL_TYPES) {
        const parentId = originalDoc._id;
        const promise = find(type, {parentId});
        promises.push(promise);
      }

      Promise.all(promises).then(results => {
        let duplicatePromises = [];

        // Gather up the docs = require(each type
        for (const docs of results) {
          for (const doc of docs) {
            const promise = module.exports.duplicate(
              doc,
              {parentId: createdDoc._id}
            );

            duplicatePromises.push(promise);
          }
        }

        // 3. Also duplicate all children, and recurse
        Promise.all(duplicatePromises).then(() => resolve(createdDoc), reject)
      })
    })
  })
};


// ~~~~~~~ //
// REQUEST //
// ~~~~~~~ //

module.exports.requestCreateAndActivate = (workspace, patch = {}) => {
  return module.exports.requestCreate(patch).then(r => {
    module.exports.workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
};

module.exports.requestDuplicateAndActivate = (workspace, request) => {
  return module.exports.requestDuplicate(request).then(r => {
    module.exports.workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
};

module.exports.requestCreate = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(module.exports.TYPE_REQUEST, patch);
};

module.exports.requestGetById = id => {
  return get(module.exports.TYPE_REQUEST, id);
};

module.exports.requestFindByParentId = parentId => {
  return find(module.exports.TYPE_REQUEST, {parentId: parentId});
};

module.exports.requestUpdate = (request, patch) => {
  return docUpdate(request, patch);
};

module.exports.requestUpdateContentType = (request, contentType) => {
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
};

module.exports.requestDuplicate = request => {
  const name = `${request.name} (Copy)`;
  return module.exports.duplicate(request, {name});
};

module.exports.requestRemove = request => {
  return remove(request);
};

module.exports.requestAll = () => {
  return all(module.exports.TYPE_REQUEST);
};

module.exports.requestGetAncestors = request => {
  return new Promise(resolve => {
    let ancestors = [];

    const next = (doc) => {
      Promise.all([
       module.exports.requestGroupGetById(doc.parentId),
       module.exports.workspaceGetById(doc.parentId)
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


// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

module.exports.requestGroupCreate = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(module.exports.TYPE_REQUEST_GROUP, patch);
};

module.exports.requestGroupUpdate = (requestGroup, patch) => {
  return docUpdate(requestGroup, patch);
};

module.exports.requestGroupGetById = id => {
  return get(module.exports.TYPE_REQUEST_GROUP, id);
};

module.exports.requestGroupFindByParentId = parentId => {
  return find(module.exports.TYPE_REQUEST_GROUP, {parentId});
};

module.exports.requestGroupRemove = requestGroup => {
  return remove(requestGroup);
};

module.exports.requestGroupAll = () => {
  return all(module.exports.TYPE_REQUEST_GROUP);
};

module.exports.requestGroupDuplicate = requestGroup => {
  const name = `${requestGroup.name} (Copy)`;
  return module.exports.duplicate(requestGroup, {name});
};


// ~~~~~~~~ //
// RESPONSE //
// ~~~~~~~~ //

module.exports.responseCreate = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  removeBulkSilently(module.exports.TYPE_RESPONSE, {parentId: patch.parentId});
  return docCreate(module.exports.TYPE_RESPONSE, patch);
};

module.exports.responseGetLatestByParentId = parentId => {
  return getMostRecentlyModified(module.exports.TYPE_RESPONSE, {parentId});
};


// ~~~~~~~ //
// COOKIES //
// ~~~~~~~ //

module.exports.cookieJarCreate = (patch = {}) => {
  return docCreate(module.exports.TYPE_COOKIE_JAR, patch);
};

module.exports.cookieJarGetOrCreateForWorkspace = workspace => {
  const parentId = workspace._id;
  return find(module.exports.TYPE_COOKIE_JAR, {parentId}).then(cookieJars => {
    if (cookieJars.length === 0) {
      return module.exports.cookieJarCreate({parentId})
    } else {
      return new Promise(resolve => resolve(cookieJars[0]));
    }
  });
};

module.exports.cookieJarAll = () => {
  return all(module.exports.TYPE_COOKIE_JAR);
};

module.exports.cookieJarGetById = id => {
  return get(module.exports.TYPE_COOKIE_JAR, id);
};

module.exports.cookieJarUpdate = (cookieJar, patch) => {
  return docUpdate(cookieJar, patch);
};


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

module.exports.workspaceGetById = id => {
  return get(module.exports.TYPE_WORKSPACE, id);
};

module.exports.workspaceCreate = (patch = {}) => {
  return docCreate(module.exports.TYPE_WORKSPACE, patch);
};

module.exports.workspaceAll = () => {
  return all(module.exports.TYPE_WORKSPACE).then(workspaces => {
    if (workspaces.length === 0) {
      return module.exports.workspaceCreate({name: 'Insomnia'})
        .then(module.exports.workspaceAll);
    } else {
      return new Promise(resolve => resolve(workspaces))
    }
  });
};

module.exports.workspaceCount = () => {
  return count(module.exports.TYPE_WORKSPACE)
};

module.exports.workspaceUpdate = (workspace, patch) => {
  return docUpdate(workspace, patch);
};

module.exports.workspaceRemove = workspace => {
  return remove(workspace);
};


// ~~~~~~~~~~~ //
// ENVIRONMENT //
// ~~~~~~~~~~~ //

module.exports.environmentCreate = (patch = {}) => {
  if (!patch.parentId) {
    throw new Error('New Environment missing `parentId`', patch);
  }

  return docCreate(module.exports.TYPE_ENVIRONMENT, patch);
};

module.exports.environmentUpdate = (environment, patch) => {
  return docUpdate(environment, patch);
};

module.exports.environmentFindByParentId = parentId => {
  return find(module.exports.TYPE_ENVIRONMENT, {parentId});
};

module.exports.environmentGetOrCreateForWorkspace = workspace => {
  const parentId = workspace._id;
  return find(module.exports.TYPE_ENVIRONMENT, {parentId}).then(environments => {
    if (environments.length === 0) {
      return module.exports.environmentCreate({parentId, name: 'Base Environment'})
    } else {
      return new Promise(resolve => resolve(environments[0]));
    }
  });
};

module.exports.environmentGetById = id => {
  return get(module.exports.TYPE_ENVIRONMENT, id);
};

module.exports.environmentRemove = environment => {
  return remove(environment);
};

module.exports.environmentAll = () => {
  return all(module.exports.TYPE_ENVIRONMENT);
};


// ~~~~~~~~ //
// SETTINGS //
// ~~~~~~~~ //

module.exports.settingsCreate = (patch = {}) => {
  return docCreate(module.exports.TYPE_SETTINGS, patch);
};

module.exports.settingsUpdate = (settings, patch) => {
  return docUpdate(settings, patch);
};

module.exports.settingsGetOrCreate = () => {
  return all(module.exports.TYPE_SETTINGS).then(results => {
    if (results.length === 0) {
      return module.exports.settingsCreate()
        .then(module.exports.settingsGetOrCreate);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
};

// ~~~~~ //
// STATS //
// ~~~~~ //

module.exports.statsCreate = (patch = {}) => {
  return docCreate(module.exports.TYPE_STATS, patch);
};

module.exports.statsUpdate = patch => {
  return module.exports.statsGet().then(stats => {
    return docUpdate(stats, patch);
  });
};

module.exports.statsGet = () => {
  return all(module.exports.TYPE_STATS).then(results => {
    if (results.length === 0) {
      return module.exports.statsCreate()
        .then(module.exports.statsGet);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
};
