import fs from 'fs'
import electron from 'electron'

import importData from '../../lib/import'

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
      properties: ['openFile'],
      filters: [{
        name: 'Insomnia Imports', extensions: ['json']
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
          err || importData(workspace, data);
          dispatch(loadStop());
        })
      })
    });
  }
}
