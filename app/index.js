import React from 'react'
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import {bindActionCreators} from 'redux'
import configureStore from './stores/configureStore'
import App from './containers/App'

import * as RequestGroupActions from './actions/requestGroups'
import * as RequestActions from './actions/requests'
import * as ResponseActions from './actions/responses'
import * as db from './database'

// Global CSS
import './css/index.scss'
import './css/lib/chrome/platform_app.css'
import './css/lib/fontawesome/css/font-awesome.css'

const store = configureStore();

// Dispatch the initial load of data
console.log('-- Init Insomnia --');

const actionFns = {
  RequestGroup: bindActionCreators(RequestGroupActions, store.dispatch),
  Request: bindActionCreators(RequestActions, store.dispatch),
  Response: bindActionCreators(ResponseActions, store.dispatch)
};

function refreshDoc (doc) {
  const fns = actionFns[doc.type];

  if (fns) {
    fns[doc._deleted ? 'remove' : 'update'](doc);
  } else if (doc.hasOwnProperty('type')) {
    console.warn('Unknown change', doc.type, doc);
  } else {
    // Probably a design doc update or something...
  }
}

function watchDB () {
  console.log('-- Watching PouchDB --');

  let buffer = [];
  let timeout = null;

  // Debounce and buffer changes if they happen in quick succession
  db.changes.on('change', (response) => {
    const doc = response.doc;

    buffer.push(doc);
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      buffer.map(refreshDoc);
      buffer = [];
    }, 50);
  });
}

function restoreDB() {
  db.allDocs().then(response => {
    response.rows.map(row => refreshDoc(row.doc));
  })
}

watchDB();
restoreDB();

render(
  <Provider store={store}><App /></Provider>,
  document.getElementById('root')
);

