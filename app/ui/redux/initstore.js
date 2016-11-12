import {bindActionCreators} from 'redux';
import * as entitiesActions from './modules/entities';
import * as globalActions from './modules/global';
import * as db from '../../common/database';
import * as models from '../../models';
import * as fetch from '../../common/fetch';

export async function initStore (dispatch) {
  const entities = bindActionCreators(entitiesActions, dispatch);
  const global = bindActionCreators(globalActions, dispatch);

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
  entities.addChanges(changes);
  db.onChange(entities.addChanges);

  // Bind to fetch commands
  fetch.onCommand(global.newCommand);

  // Load all saved app state
  const activeRequests = JSON.parse(localStorage.getItem(`insomnia.app.activeRequest`) || '{}');
  const sidebarHidden = JSON.parse(localStorage.getItem(`insomnia.app.sidebarHidden`) || '{}');
  const sidebarWidth = JSON.parse(localStorage.getItem(`insomnia.app.sidebarWidth`) || '{}');
  const paneWidth = JSON.parse(localStorage.getItem(`insomnia.app.paneWidth`) || '{}');
  const filter = JSON.parse(localStorage.getItem(`insomnia.app.filter`) || '{}');

  for (const workspaceId of Object.keys(activeRequests)) {
    global.activateRequest(workspaceId, activeRequests[workspaceId]);
  }

  for (const workspaceId of Object.keys(sidebarHidden)) {
    global.setSidebarHidden(workspaceId, sidebarHidden[workspaceId]);
  }

  // for (const workspaceId of Object.keys(sidebarWidth)) {
  //   global.activateRequest(workspaceId, sidebarWidth[workspaceId]);
  // }
  //
  // for (const workspaceId of Object.keys(paneWidth)) {
  //   global.activateRequest(workspaceId, paneWidth[workspaceId]);
  // }

  for (const workspaceId of Object.keys(filter)) {
    global.changeFilter(workspaceId, filter[workspaceId]);
  }
}
