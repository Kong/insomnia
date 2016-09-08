import * as db from '../../database';
import {getAppVersion} from '../appInfo';
import {importRequestGroupLegacy} from './legacy';
import {importRequestLegacy} from './legacy';

const VERSION_LEGACY = 1;
const VERSION_DESKTOP_APP = 2;
const TYPE_REQUEST = 'request';
const TYPE_REQUEST_GROUP = 'request_group';
const TYPE_WORKSPACE = 'workspace';
const TYPE_COOKIE_JAR = 'cookie_jar';
const TYPE_ENVIRONMENT = 'environment';

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

  switch (exportFormat) {

    case VERSION_LEGACY:
      data.items.filter(item => item._type === TYPE_REQUEST_GROUP).map(
        (rg, i) => importRequestGroupLegacy(rg, workspace._id, data.__export_format, i)
      );
      data.items.filter(item => item._type === TYPE_REQUEST).map(
        (r, i) => importRequestLegacy(r, workspace._id, data.__export_format, i)
      );
      break;

    case VERSION_DESKTOP_APP:
      data.resources.map(r => {
        if (r._type === TYPE_WORKSPACE) {
          db.workspaceGetById(r._id).then(d => d ? db.workspaceUpdate(d, r) : db.workspaceCreate(r));
        } else if (r._type === TYPE_COOKIE_JAR) {
          db.cookieJarGetById(r._id).then(d => d ? db.cookieJarUpdate(d, r) : db.cookieJarCreate(r));
        } else if (r._type === TYPE_ENVIRONMENT) {
          db.environmentGetById(r._id).then(d => d ? db.environmentUpdate(d, r) : db.environmentCreate(r));
        } else if (r._type === TYPE_REQUEST_GROUP) {
          db.requestGroupGetById(r._id).then(d => d ? db.requestGroupUpdate(d, r) : db.requestGroupCreate(r));
        } else if (r._type === TYPE_REQUEST) {
          db.requestGetById(r._id).then(d => d ? db.requestUpdate(d, r) : db.requestCreate(r));
        } else {
          console.error('Unknown doc type for import', r.type);
        }
      });
      break;

    default:
      console.error('Export format not recognized', exportFormat);
      break;
  }
}

export function exportJSON (parentDoc = null) {
  const data = {
    _type: 'export',
    __export_format: 2,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: {}
  };

  return new Promise(resolve => {
    db.withDescendants(parentDoc).then(docs => {
      data.resources = docs.filter(d => (
        d.type !== db.TYPE_RESPONSE &&
        d.type !== db.TYPE_STATS &&
        d.type !== db.TYPE_SETTINGS
      )).map(d => {
        if (d.type === db.TYPE_WORKSPACE) {
          d._type = TYPE_WORKSPACE;
        } else if (d.type === db.TYPE_COOKIE_JAR) {
          d._type = TYPE_COOKIE_JAR;
        } else if (d.type === db.TYPE_ENVIRONMENT) {
          d._type = TYPE_ENVIRONMENT;
        } else if (d.type === db.TYPE_REQUEST_GROUP) {
          d._type = TYPE_REQUEST_GROUP;
        } else if (d.type === db.TYPE_REQUEST) {
          d._type = TYPE_REQUEST;
        }

        const doc = removeMetaKeys(d);

        delete doc.type;

        return doc;
      });

      resolve(JSON.stringify(data, null, 2));
    });
  });
}


function removeMetaKeys (obj) {
  const newObj = Object.assign({}, obj);
  for (const key of Object.keys(newObj)) {
    if (key.indexOf('meta') === 0) {
      delete newObj[key];
    }
  }

  return newObj;
}
