'use strict';

import * as db from '../database';
import * as models from '../models';
import {getAppVersion} from '../../common/constants';
import {importRequestGroupLegacy, importRequestLegacy} from './legacy';

const VERSION_LEGACY = 1;
const VERSION_DESKTOP_APP = 2;
const EXPORT_TYPE_REQUEST = 'request';
const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
const EXPORT_TYPE_WORKSPACE = 'workspace';
const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
const EXPORT_TYPE_ENVIRONMENT = 'environment';

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

  // TODO: Actually figure out when we're done before resuming
  db.bufferChanges(300);

  const exportFormat = data.__export_format;

  switch (exportFormat) {

    case VERSION_LEGACY:
      data.items.filter(item => item._type === EXPORT_TYPE_REQUEST_GROUP).map(
        (rg, i) => importRequestGroupLegacy(rg, workspace._id, data.__export_format, i)
      );
      data.items.filter(item => item._type === EXPORT_TYPE_REQUEST).map(
        (r, i) => importRequestLegacy(r, workspace._id, data.__export_format, i)
      );
      break;

    case VERSION_DESKTOP_APP:
      data.resources.map(async r => {
        if (r._type === EXPORT_TYPE_WORKSPACE) {
          const d = await models.workspace.getById(r._id);
          d ? models.workspace.update(d, r) : models.workspace.create(r);
        } else if (r._type === EXPORT_TYPE_COOKIE_JAR) {
          const d = await models.cookieJar.getById(r._id);
          d ? models.cookieJar.update(d, r) : models.cookieJar.create(r);
        } else if (r._type === EXPORT_TYPE_ENVIRONMENT) {
          const d = await models.environment.getById(r._id);
          d ? models.environment.update(d, r) : models.environment.create(r);
        } else if (r._type === EXPORT_TYPE_REQUEST_GROUP) {
          const d = await models.requestGroup.getById(r._id);
          d ? models.requestGroup.update(d, r) : models.requestGroup.create(r);
        } else if (r._type === EXPORT_TYPE_REQUEST) {
          const d = await models.request.getById(r._id);
          d ? models.request.update(d, r) : models.request.create(r);
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

export async function exportJSON (parentDoc = null) {
  const data = {
    _type: 'export',
    __export_format: 2,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: {}
  };

  const docs = await db.withDescendants(parentDoc);

  data.resources = docs.filter(d => (
    d.type !== models.response.type &&
    d.type !== models.stats.type &&
    d.type !== models.settings.type
  )).map(d => {
    if (d.type === models.workspace.type) {
      d._type = EXPORT_TYPE_WORKSPACE;
    } else if (d.type === models.cookieJar.type) {
      d._type = EXPORT_TYPE_COOKIE_JAR;
    } else if (d.type === models.environment.type) {
      d._type = EXPORT_TYPE_ENVIRONMENT;
    } else if (d.type === models.requestGroup.type) {
      d._type = EXPORT_TYPE_REQUEST_GROUP;
    } else if (d.type === models.request.type) {
      d._type = EXPORT_TYPE_REQUEST;
    }

    const doc = removeMetaKeys(d);

    delete doc.type;

    return doc;
  });

  return JSON.stringify(data, null, 2);
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
