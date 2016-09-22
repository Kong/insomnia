'use strict';

const electron = require('electron');
const NeDB = require('nedb');
const fsPath = require('path');
const {DB_PERSIST_INTERVAL} = require('../constants');
const {generateId} = require('../util');
const {isDevelopment} = require('../appInfo');

module.exports.CHANGE_INSERT = 'insert';
module.exports.CHANGE_UPDATE = 'update';
module.exports.CHANGE_REMOVE = 'remove';


// ~~~~~~ //
// MODELS //
// ~~~~~~ //

module.exports.stats = require('./models/stats');
module.exports.settings = require('./models/settings');
module.exports.workspace = require('./models/workspace');
module.exports.environment = require('./models/environment');
module.exports.cookieJar = require('./models/cookieJar');
module.exports.requestGroup = require('./models/requestGroup');
module.exports.request = require('./models/request');
module.exports.response = require('./models/response');

const MODELS = [
  module.exports.stats,
  module.exports.settings,
  module.exports.workspace,
  module.exports.environment,
  module.exports.cookieJar,
  module.exports.requestGroup,
  module.exports.request,
  module.exports.response
];
const MODEL_MAP = {};

module.exports.initModel = doc => Object.assign({
  modified: Date.now(),
  created: Date.now(),
  parentId: null
}, doc);

module.exports.ALL_TYPES = MODELS.map(m => m.type);

for (const model of MODELS) {
  MODEL_MAP[model.type] = model;
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

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

  return new Promise(resolve => {
    db = {};

    if (isDevelopment()) {
      global.db = db;
    }

    // Fill in the defaults

    module.exports.ALL_TYPES.map(t => {
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


// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //

let bufferingChanges = false;
let changeBuffer = [];
let changeListeners = [];
let bufferTimeout = null;

module.exports.onChange = callback => {
  console.log(`-- Added DB Listener -- `);
  changeListeners.push(callback);
};

module.exports.offChange = callback => {
  console.log(`-- Removed DB Listener -- `);
  changeListeners = changeListeners.filter(l => l !== callback);
};

module.exports.bufferChanges = (millis = 1000) => {
  bufferingChanges = true;
  bufferTimeout = setTimeout(() => {
    module.exports.flushChanges()
  }, millis);
};

module.exports.flushChanges = () => {
  clearTimeout(bufferTimeout);
  bufferingChanges = false;
  bufferTimeout = null;

  const changes = [...changeBuffer];
  changeBuffer = [];

  // Notify async so we don't block
  process.nextTick(() => {
    changeListeners.map(fn => fn(changes));
  })
};

function notifyOfChange (event, doc) {
  changeBuffer.push([event, doc]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    module.exports.flushChanges();
  }
}


// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

module.exports.getMostRecentlyModified = (type, query = {}) => {
  return new Promise(resolve => {
    db[type].find(query).sort({modified: -1}).limit(1).exec((err, docs) => {
      resolve(docs.length ? docs[0] : null);
    })
  })
};

module.exports.find = (type, query = {}) => {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      const modelDefaults = MODEL_MAP[type].init();
      const docs = rawDocs.map(rawDoc => {
        return Object.assign({}, modelDefaults, rawDoc);
      });

      resolve(docs);
    });
  });
};

module.exports.all = type => {
  return module.exports.find(type);
};

module.exports.getWhere = (type, query) => {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      if (rawDocs.length === 0) {
        // Not found. Too bad!
        return resolve(null);
      }

      const modelDefaults = MODEL_MAP[type].init();
      resolve(Object.assign({}, modelDefaults, rawDocs[0]));
    });
  });
};

module.exports.get = (type, id) => {
  return module.exports.getWhere(type, {_id: id});
};

module.exports.count = (type, query = {}) => {
  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
};

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

module.exports.update = doc => {
  return new Promise((resolve, reject) => {
    db[doc.type].update({_id: doc._id}, doc, err => {
      if (err) {
        return reject(err);
      }

      resolve(doc);
      notifyOfChange(module.exports.CHANGE_UPDATE, doc);
    });
  });
};

module.exports.remove = doc => {
  module.exports.bufferChanges();

  return new Promise(resolve => {
    module.exports.withDescendants(doc).then(docs => {
      const docIds = docs.map(d => d._id);
      const types = [...new Set(docs.map(d => d.type))];
      const promises = types.map(t => {
        db[t].remove({_id: {$in: docIds}}, {multi: true})
      });

      Promise.all(promises).then(() => {
        docs.map(d => notifyOfChange(module.exports.CHANGE_REMOVE, d));
        resolve();
        module.exports.flushChanges();
      });
    });
  });
};

/**
 * Remove a lot of documents quickly and silently
 *
 * @param type
 * @param query
 * @returns {Promise.<T>}
 */
module.exports.removeBulkSilently = (type, query) => {
  return new Promise(resolve => {
    db[type].remove(query, {multi: true}, err => resolve());
  });
};


// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

module.exports.docUpdate = (originalDoc, patch = {}) => {
  const doc = Object.assign(
    MODEL_MAP[originalDoc.type].init(),
    originalDoc,
    patch,
    {modified: Date.now()}
  );

  return module.exports.update(doc);
};

module.exports.docCreate = (type, patch = {}) => {
  const idPrefix = MODEL_MAP[type].prefix;

  if (!idPrefix) {
    throw new Error(`No ID prefix for ${type}`)
  }

  const doc = Object.assign(
    {_id: generateId(idPrefix)},
    MODEL_MAP[type].init(),
    patch,

    // Fields that the user can't touch
    {
      type: type,
      modified: Date.now()
    }
  );

  return module.exports.insert(doc);
};

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
        const promise = module.exports.find(type, {parentId});
        promises.push(promise);
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

module.exports.duplicate = (originalDoc, patch = {}, buffer = true) => {
  buffer && module.exports.bufferChanges();
  return new Promise((resolve, reject) => {

    // 1. Copy the doc
    const newDoc = Object.assign({}, originalDoc, patch);
    delete newDoc._id;
    delete newDoc.created;
    delete newDoc.modified;

    module.exports.docCreate(newDoc.type, newDoc).then(createdDoc => {

      // 2. Get all the children
      const promises = [];
      for (const type of module.exports.ALL_TYPES) {
        const parentId = originalDoc._id;
        const promise = module.exports.find(type, {parentId});
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
        Promise.all(duplicatePromises).then(() => {
          buffer && module.exports.flushChanges();
          resolve(createdDoc)
        }, err => {
          reject(err);
        })
      })
    })
  })
};
