'use strict';

module.exports.id = 'postman';
module.exports.name = 'Postman';
module.exports.description = 'Importer for Postman collections';

let requestCount = 1;
let requestGroupCount = 1;

module.exports.convert = function(rawData) {
  requestCount = 1;
  requestGroupCount = 1;

  let data;
  try {
    data = JSON.parse(rawData);
    if (
      data.info.schema === 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json'
    ) {
      return importCollection(data);
    }
  } catch (e) {
    // Nothing
  }

  return null;
};

function importCollection(collection) {
  const collectionFolder = {
    parentId: '__WORKSPACE_ID__',
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: collection.info.name,
    description: collection.info.description
  };
  return [collectionFolder, ...importItem(collection.item, collectionFolder._id)];
}

function importItem(items, parentId = '__WORKSPACE_ID__') {
  let resources = [];

  for (const item of items) {
    if (item.hasOwnProperty('request')) {
      resources = [...resources, importRequestItem(item, parentId)];
    } else {
      const requestGroup = importFolderItem(item, parentId);
      resources = [...resources, requestGroup, ...importItem(item.item, requestGroup._id)];
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

function importRequestItem(item, parentId) {
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
    body: importBody(request.body)
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

function importBody(body) {
  if (!body) {
    return {};
  } else if (body.mode === 'raw') {
    return importBodyRaw(body.raw);
  } else if (body.mode === 'urlencoded') {
    return importBodyFormUrlEncoded(body.urlencoded);
  } else if (body.mode === 'formdata') {
    // TODO: Handle this as properly as multipart/form-data
    return importBodyFormdata(body.formdata);
  } else {
    return {};
  }
}

function importBodyFormdata(formdata) {
  const params = formdata.map(({ key, value, type, enabled, src }) => {
    const item = {
      type,
      name: key,
      disabled: !enabled
    };

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

function importBodyFormUrlEncoded(urlEncoded) {
  const params = urlEncoded.map(({ key, value, enabled }) => ({
    value,
    name: key,
    disabled: !enabled
  }));

  return {
    params,
    mimeType: 'application/x-www-form-urlencoded'
  };
}

function importBodyRaw(raw) {
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
