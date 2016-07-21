import * as db from '../../database';
import {getAppVersion} from '../appInfo';

const VERSION_CHROME_APP = 1;
const VERSION_DESKTOP_APP = 2;
const TYPE_REQUEST = 'request';
const TYPE_REQUEST_GROUP = 'request_group';
// const TYPE_WORKSPACE = 'workspace';
const FORMAT_MAP = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  text: 'text/plain'
};


// function importWorkspace (iWorkspace, exportFormat) {
//   if (exportFormat === VERSION_DESKTOP_APP) {
//     db.workspaceCreate({
//       name: iWorkspace.name,
//       environments: iWorkspace.environments
//     });
//   } else {
//     console.error(`Unknown export format ${exportFormat}`)
//   }
// }

function importRequestGroup (iRequestGroup, parentId, exportFormat) {
  if (exportFormat === VERSION_CHROME_APP) {
    return db.requestGroupCreate({
      parentId,
      name: iRequestGroup.name,
      environment: (iRequestGroup.environments || {}).base || {},
      metaCollapsed: true
    }).then(requestGroup => {
      // Sometimes (maybe all the time, I can't remember) requests will be nested
      if (iRequestGroup.hasOwnProperty('requests')) {
        // Let's process them oldest to newest
        iRequestGroup.requests.reverse();
        iRequestGroup.requests.map(
          r => importRequest(r, requestGroup._id, exportFormat)
        );
      }
    });
  } else if (exportFormat === VERSION_DESKTOP_APP) {
    return db.requestGroupCreate({
      parentId,
      name: iRequestGroup.name,
      environment: iRequestGroup.environment,
      metaCollapsed: true
    });
  } else {
    console.error(`Unknown export format ${exportFormat}`)
  }
}

function importRequest (importedRequest, parentId, exportFormat) {
  if (exportFormat === VERSION_CHROME_APP) {
    let auth = {};
    if (importedRequest.authentication.username) {
      auth = {
        username: importedRequest.authentication.username,
        password: importedRequest.authentication.password
      }
    }

    db.requestCreate({
      parentId,
      name: importedRequest.name,
      url: importedRequest.url,
      method: importedRequest.method,
      body: importedRequest.body,
      headers: importedRequest.headers || [],
      parameters: importedRequest.params || [],
      contentType: FORMAT_MAP[importedRequest.__insomnia.format] || 'text/plain',
      authentication: auth
    });
  } else if (exportFormat === VERSION_DESKTOP_APP) {
    db.requestCreate({
      parentId,
      name: importedRequest.name,
      url: importedRequest.url,
      method: importedRequest.method,
      body: importedRequest.body,
      headers: importedRequest.headers,
      parameters: importedRequest.parameters,
      contentType: importedRequest.contentType,
      authentication: importedRequest.authentication
    });
  } else {
    console.error(`Unknown export format ${exportFormat}`)
  }
}

export function importJSON (workspace, json) {
  let data;

  try {
    data = JSON.parse(json);
  } catch (e) {
    // TODO: Handle these errors
    return;
  }

  if (!data.hasOwnProperty('_type')) {
    // TODO: Handle these errors
    return;
  }

  const exportFormat = data.__export_format;

  if (exportFormat === VERSION_CHROME_APP) {
    data.items.reverse().filter(i => i._type === TYPE_REQUEST_GROUP).map(
      rg => importRequestGroup(rg, workspace._id, data.__export_format)
    );

    data.items.reverse().filter(i => i._type === TYPE_REQUEST).map(
      r => importRequest(r, workspace._id, data.__export_format)
    );
  } else if (exportFormat === VERSION_DESKTOP_APP) {
    const requestGroupIdMap = {
      // [oldId]: newId
    };

    const requestGroupPromises = [];
    data.resources.filter(i => i._type === TYPE_REQUEST_GROUP).map(iRg => {
      const p = importRequestGroup(iRg, workspace._id, data.__export_format).then(rg => {
        requestGroupIdMap[iRg._id] = rg._id;
        return rg;
      });
      requestGroupPromises.push(p);
    });

    Promise.all(requestGroupPromises).then(() => {

      // RequestGroups are imported, and we have the new IDs. Now we can import the requests...

      data.resources.filter(i => i._type === TYPE_REQUEST).map(iR => {

        // If we couldn't find the parentID in our RequestGroups, fall back to the Workspace id
        const parentId = requestGroupIdMap[iR.parentId] || workspace._id;

        importRequest(iR, parentId, exportFormat);
      });
    });
  } else {
    console.error(`Unknown export format ${exportFormat}`)
  }
}

export function exportJSON () {
  const data = {
    _type: 'export',
    __export_format: 2,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: {}
  };

  return new Promise(resolve => {
    Promise.all([
      db.requestAll(),
      db.requestGroupAll(),
      // db.workspaceAll()
    ]).then(([
      requests,
      requestGroups,
      // workspaces
    ]) => {
      const exportingRequests = requests.map(r => ({
        _type: TYPE_REQUEST,
        created: r.created,
        modified: r.modified,
        parentId: r.parentId,
        url: r.url,
        name: r.name,
        method: r.method,
        contentType: r.contentType,
        body: r.body,
        parameters: r.parameters,
        headers: r.headers,
        authentication: r.authentication
      }));

      const exportingRequestGroups = requestGroups.map(rg => ({
        _type: TYPE_REQUEST_GROUP,
        created: rg.created,
        modified: rg.modified,
        name: rg.name,
        environment: rg.environment,
        parentId: rg.parentId,
      }));

      // const exportingWorkspaces = workspaces.map(w => ({
      //   _type: TYPE_WORKSPACE,
      //   created: w.created,
      //   modified: w.modified,
      //   name: w.name,
      //   environments: w.environments
      // }));

      data.resources = [
        ...exportingRequests,
        ...exportingRequestGroups,
        // ...exportingWorkspaces
      ];

      resolve(JSON.stringify(data, null, 2));
    });
  });
}

