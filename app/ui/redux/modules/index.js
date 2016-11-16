import {bindActionCreators, combineReducers} from 'redux';
import entitiesReducer from './entities';
import * as entities from './entities';
import globalReducer from './global';
import * as global from './global';
import workspaceMetaReducer from './workspaceMeta';
import * as workspaceMeta from './workspaceMeta';
import requestMetaReducer from './requestMeta';
import * as requestMeta from './requestMeta';
import requestGroupMetaReducer from './requestGroupMeta';
import * as requestGroupMeta from './requestGroupMeta';
import * as db from '../../../common/database';
import * as models from '../../../models';
import * as fetch from '../../../common/fetch';

export async function init (dispatch) {
  const {addChanges} = bindActionCreators(entities, dispatch);
  const {newCommand} = bindActionCreators(global, dispatch);

  // Restore docs in parent->child->grandchild order
  const allDocs = [
    ...(await models.settings.all()),
    ...(await models.workspace.all()),
    ...(await models.environment.all()),
    ...(await models.cookieJar.all()),
    ...(await models.requestGroup.all()),
    ...(await models.request.all())
  ];

  // Link DB changes to entities reducer/actions
  const changes = allDocs.map(doc => [db.CHANGE_UPDATE, doc]);
  addChanges(changes);
  db.onChange(addChanges);

  // Bind to fetch commands
  fetch.onCommand(newCommand);

  dispatch(requestMeta.init());
  dispatch(requestGroupMeta.init());
  dispatch(workspaceMeta.init());
  dispatch(global.init());
}

export const reducer = combineReducers({
  entities: entitiesReducer,
  workspaceMeta: workspaceMetaReducer,
  requestMeta: requestMetaReducer,
  requestGroupMeta: requestGroupMetaReducer,
  global: globalReducer,
});
