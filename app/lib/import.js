import * as db from '../database'

const TYPE_REQUEST = 'request';
const TYPE_REQUEST_GROUP = 'request_group';
const FORMAT_MAP = {
  'json': 'application/json'
  // TODO: Fill these out
};

function importRequestGroup (iRequestGroup, parentId, exportFormat) {
  if (exportFormat === 1) {
    const requestGroup = db.requestGroupCreate({
      parentId,
      collapsed: true,
      name: iRequestGroup.name,
      environment: (iRequestGroup.environments || {}).base || {}
    });

    // Sometimes (maybe all the time, I can't remember) requests will be nested
    if (iRequestGroup.hasOwnProperty('requests')) {
      // Let's process them oldest to newest
      iRequestGroup.requests.reverse();
      iRequestGroup.requests.map(
        r => importRequest(r, requestGroup._id, exportFormat)
      );
    }
  }
}

function importRequest (iRequest, parentId, exportFormat) {
  if (exportFormat === 1) {
    let auth = {};
    if (iRequest.authentication.username) {
      auth = {
        username: iRequest.authentication.username,
        password: iRequest.authentication.password
      }
    }

    db.requestCreate({
      parentId,
      activated: 0, // Don't activate imported requests
      name: iRequest.name,
      url: iRequest.url,
      method: iRequest.method,
      body: iRequest.body,
      headers: iRequest.headers || [],
      params: iRequest.params || [],
      contentType: FORMAT_MAP[iRequest.__insomnia.format] || 'text/plain',
      authentication: auth
    });
  }
}

export default function (workspace, txt) {
  let data;

  try {
    data = JSON.parse(txt);
  } catch (e) {
    // TODO: Handle these errors
    return;
  }


  if (!data.hasOwnProperty('_type') || !data.hasOwnProperty('items')) {
    // TODO: Handle these errors
    return;
  }

  data.items.reverse().filter(i => i._type === TYPE_REQUEST_GROUP).map(
    rg => importRequestGroup(rg, workspace._id, data.__export_format)
  );

  data.items.reverse().filter(i => i._type === TYPE_REQUEST).map(
    r => importRequest(r, workspace._id, data.__export_format)
  );
}
