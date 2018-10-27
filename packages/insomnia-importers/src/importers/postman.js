'use strict';

module.exports.id = 'postman';
module.exports.name = 'Postman';
module.exports.description = 'Importer for Postman collections';

let requestCount = 1;
let requestGroupCount = 1;
let currentSchema = '';

const POSTMAN_SCHEMA_V2_0 = 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json';
const POSTMAN_SCHEMA_V2_1 = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

module.exports.convert = function(rawData) {
  requestCount = 1;
  requestGroupCount = 1;

  let data;
  try {
    data = JSON.parse(rawData);
    if (data.info.schema === POSTMAN_SCHEMA_V2_0 || data.info.schema === POSTMAN_SCHEMA_V2_1) {
      return importCollection(data, data.info.schema);
    }
  } catch (e) {
    // Nothing
  }

  return null;
};

function importCollection(collection, schema) {
  const collectionFolder = {
    parentId: '__WORKSPACE_ID__',
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: collection.info.name,
    description: collection.info.description
  };
  return [collectionFolder, ...importItem(collection.item, collectionFolder._id, schema)];
}

function importItem(items, parentId = '__WORKSPACE_ID__', schema) {
  let resources = [];

  for (const item of items) {
    if (item.hasOwnProperty('request')) {
      resources = [...resources, importRequestItem(item, parentId, schema)];
    } else {
      const requestGroup = importFolderItem(item, parentId);
      resources = [...resources, requestGroup, ...importItem(item.item, requestGroup._id, schema)];
    }
  }

  return resources;
}

function importFolderItem(item, parentId) {
  return {
    parentId,
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: item.name,
    description: item.description || ''
  };
}

function importRequestItem(item, parentId, schema) {
  const { request } = item;
  return {
    parentId,
    _id: `__REQ_${requestCount++}__`,
    _type: 'request',
    name: item.name || '',
    description: request.description || '',
    url: importUrl(request.url),
    method: request.method || 'GET',
    headers: mapImporter(request.header, importHeader),
    body: importBody(request.body, schema)
  };
}

function importHeader(header) {
  return Object.assign({
    name: header.key,
    value: header.value
  });
}

function importUrl(url) {
  if (!url) {
    return '';
  }

  if (url.raw) {
    return url.raw;
  }

  return url;
}

function importBody(body, schema) {
  if (!body) {
    return {};
  } else if (body.mode === 'raw') {
    return importBodyRaw(body.raw);
  } else if (body.mode === 'urlencoded') {
    return importBodyFormUrlEncoded(body.urlencoded, schema);
  } else if (body.mode === 'formdata') {
    // TODO: Handle this as properly as multipart/form-data
    return importBodyFormdata(body.formdata, schema);
  } else {
    return {};
  }
}

function importBodyFormdata(formdata, schema) {
  const params = formdata.map(({ key, value, type, enabled, disabled, src }) => {
    const item = {
      type,
      name: key
    };

    if (schema === POSTMAN_SCHEMA_V2_0) {
      item.disabled = !enabled;
    } else if (schema === POSTMAN_SCHEMA_V2_1) {
      item.disabled = !!disabled;
    }

    if (type === 'file') {
      item.fileName = src;
    } else {
      item.value = value;
    }

    return item;
  });

  return {
    params,
    mimeType: 'multipart/form-data'
  };
}

function importBodyFormUrlEncoded(urlEncoded, schema) {
  const params = urlEncoded.map(({ key, value, enabled, disabled }) => {
    const item = {
      value,
      name: key
    };

    if (schema === POSTMAN_SCHEMA_V2_0) {
      item.disabled = !enabled;
    } else if (schema === POSTMAN_SCHEMA_V2_1) {
      item.disabled = !!disabled;
    }

    return item;
  });

  return {
    params,
    mimeType: 'application/x-www-form-urlencoded'
  };
}

function importBodyRaw(raw) {
  if (raw === '') {
    return {};
  }

  return {
    mimeType: '',
    text: raw
  };
}

function mapImporter(arr, importFn) {
  if (!arr) {
    return [];
  } else {
    return arr.map(importFn);
  }
}
