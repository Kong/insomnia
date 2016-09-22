import electron from 'electron';
import fs from 'fs';

import {importJSON, exportJSON} from 'backend/export/database';
import * as db from 'backend/database/index';
import {trackEvent} from 'backend/analytics';

const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';

const initialState = {
  loading: false
};


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case LOAD_START:
      return Object.assign({}, state, {loading: true});

    case LOAD_STOP:
      return Object.assign({}, state, {loading: false});

    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function loadStart () {
  return {type: LOAD_START};
}

export function loadStop () {
  return {type: LOAD_STOP};
}

export function importFile (workspace) {
  return dispatch => {
    dispatch(loadStart());

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [{
        // Allow empty extension and JSON
        name: 'Insomnia Import', extensions: ['', 'json']
      }]
    };

    electron.remote.dialog.showOpenDialog(options, paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        trackEvent('Import Cancel');
        return;
      }

      // Let's import all the paths!
      paths.map(path => {
        fs.readFile(path, 'utf8', (err, data) => {
          // Unset the current active request first because we might be updating it
          db.workspace.update(workspace, {metaActiveRequestId: null}).then(() => {
            dispatch(loadStop());
            if (err) {
              trackEvent('Import Fail');
              console.warn('Import Failed', err);
              return;
            }

            importJSON(workspace, data);
            trackEvent('Import');
          });
        })
      })
    });
  }
}

export function exportFile (parentDoc = null) {
  return dispatch => {
    dispatch(loadStart());

    exportJSON(parentDoc).then(json => {
      const options = {
        title: 'Export Insomnia Data',
        buttonLabel: 'Export',
        filters: [{
          name: 'Insomnia Export', extensions: ['json']
        }]
      };

      electron.remote.dialog.showSaveDialog(options, filename => {
        if (!filename) {
          trackEvent('Export Cancel');
          // It was cancelled, so let's bail out
          dispatch(loadStop());
          return;
        }

        fs.writeFile(filename, json, {}, err => {
          if (err) {
            console.warn('Export failed', err);
            trackEvent('Export Fail');
            return;
          }
          trackEvent('Export');
          dispatch(loadStop());
        });
      });
    });
  }
}
