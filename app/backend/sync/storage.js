import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';

/**
 * Get all the ResourceGroups
 *
 * @returns {Promise}
 */
export function all () {
  return new Promise((resolve, reject) => {
    _getDB().find({}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs);
      }
    })
  });
}

export function activateResourceGroup (resourceGroup) {
  localStorage.setItem('activeResourceGroup', JSON.stringify(resourceGroup));
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;
function _getDB () {
  if (!_database) {
    // NOTE: Do not EVER change this. EVER!
    const basePath = electron.remote.app.getPath('userData');
    const filePath = fsPath.join(basePath, `insomnia.sync.resources.db`);

    // Fill in the defaults
    _database = new NeDB({filename: filePath, autoload: true});

    // Done
    console.log(`-- Initialize Sync DB at ${filePath} --`);
  }

  return _database;
}
