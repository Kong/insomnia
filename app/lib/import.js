import * as db from '../database'

const TYPE_REQUEST = 'request';
const TYPE_REQUEST_GROUP = 'request_group';
const FORMAT_MAP = {
  'json': 'application/json'
};

function importRequestGroup (iRequestGroup, exportFormat) {
  if (exportFormat === 1) {
    const requestGroup = db.requestGroupCreate({
      name: iRequestGroup.name,
      environment: (iRequestGroup.environments || {}).base || {}
    });

    // Sometimes (maybe all the time, I can't remember) requests will be nested
    if (iRequestGroup.hasOwnProperty('requests')) {
      iRequestGroup.requests.map(
        r => importRequest(r, requestGroup._id, exportFormat)
      );
    }
  }
}

function importRequest (iRequest, parent, exportFormat) {
  if (exportFormat === 1) {
    let auth = {};
    if (iRequest.authentication.username) {
      auth = {
        username: iRequest.authentication.username,
        password: iRequest.authentication.password
      }
    }
    
    db.requestCreate({
      name: iRequest.name,
      url: iRequest.url,
      method: iRequest.method,
      body: iRequest.body,
      headers: iRequest.headers || [],
      params: iRequest.params || [],
      contentType: FORMAT_MAP[iRequest.__insomnia.format] || 'text/plain',
      authentication: auth,
      parent: parent
    });
  }
}

export default function (txt, callback) {
  let data;
  
  try {
    data = JSON.parse(txt);
  } catch (e) {
    return callback(new Error('Invalid Insomnia export'));
  }
  

  if (!data.hasOwnProperty('_type') || !data.hasOwnProperty('items')) {
    return callback(new Error('Invalid Insomnia export'));
  }
  
  data.items.filter(i => i._type === TYPE_REQUEST_GROUP).map(
    rg => importRequestGroup(rg, data.__export_format)
  );

  data.items.filter(i => i._type === TYPE_REQUEST).map(
    r => importRequest(r, data.__export_format)
  );
}
