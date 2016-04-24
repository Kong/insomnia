import {bindActionCreators} from 'redux'
import * as RequestGroupActions from './modules/requestGroups'
import * as RequestActions from './modules/requests'
import * as ResponseActions from './modules/responses'
import * as WorkspaceActions from './modules/workspaces'
import * as db from '../database'

// HACK: Because PouchDB doesn't let us unsub a single listener
let haveSubbedToPouch = false;

export function initStore (dispatch) {
  const actionFunctions = {
    RequestGroup: bindActionCreators(RequestGroupActions, dispatch),
    Request: bindActionCreators(RequestActions, dispatch),
    Response: bindActionCreators(ResponseActions, dispatch),
    Workspace: bindActionCreators(WorkspaceActions, dispatch)
  };

  const docChanged = doc => {
    if (!doc.hasOwnProperty('type')) {
      return;
    }

    const fns = actionFunctions[doc.type];
    fns && fns[doc._deleted ? 'remove' : 'update'](doc);
  };

  console.log('-- Restoring Store --');

  let docsThatChanged = [];
  return db.workspaceAll().then(res => {
    res.docs.map(doc => docsThatChanged.push(doc));
  }).then(() => {
    return db.workspaceGetActive()
  }).then(res => {
    const workspace = res.docs.length ? res.docs[0] : db.workspaceCreate();

    const restoreChildren = (doc, maxDepth, depth = 0) => {
      docsThatChanged.push(doc);

      return db.getChildren(doc).then(res => {
        return Promise.all(
          res.docs.map(doc => restoreChildren(doc, maxDepth, depth++))
        );
      })
    };

    return restoreChildren(workspace, 5);
  }).then(() => {
    // We saved all the updates for the end so the UI doesn't jitter
    docsThatChanged.map(docChanged);
  }).then(() => {
    if (!haveSubbedToPouch) {
      db.changes.on('change', res => docChanged(res.doc));
      haveSubbedToPouch = true;
    }
  });
}

