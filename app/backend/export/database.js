'use strict';

const db = require('../database');
const {getAppVersion} = require('../appInfo');
const {importRequestGroupLegacy} = require('./legacy');
const {importRequestLegacy} = require('./legacy');

const VERSION_LEGACY = 1;
const VERSION_DESKTOP_APP = 2;
const EXPORT_TYPE_REQUEST = 'request';
const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
const EXPORT_TYPE_WORKSPACE = 'workspace';
const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
const EXPORT_TYPE_ENVIRONMENT = 'environment';

module.exports.importJSON = (workspace, json) => {
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
      data.resources.map(r => {
        if (r._type === EXPORT_TYPE_WORKSPACE) {
          db.workspace.getById(r._id).then(d => d ? db.workspace.update(d, r) : db.workspace.create(r));
        } else if (r._type === EXPORT_TYPE_COOKIE_JAR) {
          db.cookieJar.getById(r._id).then(d => d ? db.cookieJar.update(d, r) : db.cookieJar.create(r));
        } else if (r._type === EXPORT_TYPE_ENVIRONMENT) {
          db.environment.getById(r._id).then(d => d ? db.environment.update(d, r) : db.environment.create(r));
        } else if (r._type === EXPORT_TYPE_REQUEST_GROUP) {
          db.requestGroup.getById(r._id).then(d => d ? db.requestGroup.update(d, r) : db.requestGroup.create(r));
        } else if (r._type === EXPORT_TYPE_REQUEST) {
          db.request.getById(r._id).then(d => d ? db.request.update(d, r) : db.request.create(r));
        } else {
          console.error('Unknown doc type for import', r.type);
        }
      });
      break;

    default:
      console.error('Export format not recognized', exportFormat);
      break;
  }
};

module.exports.exportJSON = (parentDoc = null) => {
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
        d.type !== db.response.type &&
        d.type !== db.stats.type &&
        d.type !== db.settings.type
      )).map(d => {
        if (d.type === db.workspace.type) {
          d._type = EXPORT_TYPE_WORKSPACE;
        } else if (d.type === db.cookieJar.type) {
          d._type = EXPORT_TYPE_COOKIE_JAR;
        } else if (d.type === db.environment.type) {
          d._type = EXPORT_TYPE_ENVIRONMENT;
        } else if (d.type === db.requestGroup.type) {
          d._type = EXPORT_TYPE_REQUEST_GROUP;
        } else if (d.type === db.request.type) {
          d._type = EXPORT_TYPE_REQUEST;
        }

        const doc = removeMetaKeys(d);

        delete doc.type;

        return doc;
      });

      resolve(JSON.stringify(data, null, 2));
    });
  });
};


function removeMetaKeys (obj) {
  const newObj = Object.assign({}, obj);
  for (const key of Object.keys(newObj)) {
    if (key.indexOf('meta') === 0) {
      delete newObj[key];
    }
  }

  return newObj;
}
