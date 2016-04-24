import {bindActionCreators} from 'redux'
import * as RequestGroupActions from './modules/workspaces/requestGroups'
import * as RequestActions from './modules/workspaces/requests'
import * as ResponseActions from './modules/workspaces/responses'
import * as WorkspaceActions from './modules/workspaces'
import * as db from '../database'

const CHANGE_ID = 'store.listener';

export function initStore (dispatch) {
  db.offChange(CHANGE_ID);

  const actionFunctions = [
    // NOTE: Order matters here. Should be top -> bottom tree 
    ['Workspace', bindActionCreators(WorkspaceActions, dispatch)],
    ['RequestGroup', bindActionCreators(RequestGroupActions, dispatch)],
    ['Request', bindActionCreators(RequestActions, dispatch)],
    ['Response', bindActionCreators(ResponseActions, dispatch)]
  ];

  const docChanged = doc => {
    if (!doc.hasOwnProperty('type')) {
      return;
    }

    const [_, fns] = actionFunctions.find(fn => fn[0] === doc.type);
    fns && fns[doc._deleted ? 'remove' : 'update'](doc);
  };

  console.log('-- Restoring Store --');

  // Start building a list of docs by type. Keyed by _id so it doesn't
  // matter if we try adding the same one twice 
  let docsThatChanged = {};

  const start = Date.now();
  return db.workspaceAll().then(res => {
    res.docs.map(doc => {
      docsThatChanged[doc._id] = doc;
    });
  }).then(() => {
    return db.workspaceGetActive()
  }).then(res => {
    const workspace = res.docs.length ? res.docs[0] : db.workspaceCreate();

    const restoreChildren = (doc, maxDepth, depth = 0) => {
      docsThatChanged[doc._id] = doc;

      return db.getChildren(doc).then(res => {
        return Promise.all(
          res.docs.map(doc => restoreChildren(doc, maxDepth, depth++))
        );
      })
    };

    return restoreChildren(workspace, 5);
  }).then(() => {
    actionFunctions.map(tuple => {
      const [t, fns] = tuple;
      const docs = Object.keys(docsThatChanged).map(
        t => docsThatChanged[t]
      ).filter(
        doc => doc.type === t
      );
      
      fns.replace(docs)
    });
    console.log(`Restore took ${(Date.now() - start) / 1000} s`);
  }).then(() => {
    db.onChange(CHANGE_ID, res => docChanged(res.doc));
  });
}

