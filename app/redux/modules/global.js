import electron from 'electron';
import fs from 'fs';
import path from 'path';

import {importJSON, exportJSON} from '../../lib/export/database';

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
        name: 'Insomnia Import', extensions: ['json']
      }]
    };

    electron.remote.dialog.showOpenDialog(options, paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        return;
      }

      // Let's import all the paths!
      paths.map(path => {
        fs.readFile(path, 'utf8', (err, data) => {
          err || importJSON(workspace, data);
          dispatch(loadStop());
        })
      })
    });
  }
}

export function exportFile () {
  return dispatch => {
    dispatch(loadStart());

    exportJSON().then(json => {
      const options = {
        title: 'Export Insomnia Data',
        buttonLabel: 'Export',
        filters: [{
          name: 'Insomnia Export', extensions: ['json']
        }]
      };

      electron.remote.dialog.showSaveDialog(options, filename => {
        if (!filename) {
          // It was cancelled, so let's bail out
          dispatch(loadStop());
          return;
        }

        fs.writeFile(filename, json, {}, err => {
          dispatch(loadStop());
        });
      });
    });
  }
}
