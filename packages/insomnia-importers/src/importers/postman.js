'use strict';

module.exports.id = 'postman';
module.exports.name = 'Postman';
module.exports.description = 'Importer for Postman collections';

let requestCount = 1;
let requestGroupCount = 1;

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
  const postmanVariable = importVariable(collection.variable || []);
  const collectionFolder = {
    parentId: '__WORKSPACE_ID__',
    _id: `__GRP_${requestGroupCount++}__`,
    _type: 'request_group',
    name: collection.info.name,
    description: collection.info.description || '',
  };
  if (postmanVariable) {
    collectionFolder.variable = postmanVariable;
  }
  return [collectionFolder, ...importItem(collection.item, collectionFolder._id, schema)];
}

function importVariable(items) {
  const variable = {};
  if (items.length === 0) {
    return null;
  } else {
    for (let idx = 0; idx < items.length; idx++) {
      variable[items[idx].key] = items[idx].value;
    }
  }

  return variable;
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
    description: item.description || '',
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
    body: importBody(request.body, schema),
    authentication: importAuthentication(request.auth, schema),
  };
}

function importHeader(header) {
  return Object.assign({
    name: header.key,
    value: header.value,
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
      name: key,
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
    mimeType: 'multipart/form-data',
  };
}

function importBodyFormUrlEncoded(urlEncoded, schema) {
  const params = urlEncoded.map(({ key, value, enabled, disabled }) => {
    const item = {
      value,
      name: key,
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
    mimeType: 'application/x-www-form-urlencoded',
  };
}

function importBodyRaw(raw) {
  if (raw === '') {
    return {};
  }

  return {
    mimeType: '',
    text: raw,
  };
}

function mapImporter(arr, importFn) {
  if (!arr) {
    return [];
  } else {
    return arr.map(importFn);
  }
}

function importAuthentication(auth, schema) {
  if (!auth) {
    return {};
  }
  if (auth.type === 'awsv4') {
    return importAwsV4Authentication(auth, schema);
  } else if (auth.type === 'basic') {
    return importBasicAuthentication(auth, schema);
  } else if (auth.type === 'bearer') {
    return importBearerTokenAuthentication(auth, schema);
  } else if (auth.type === 'digest') {
    return importDigestAuthentication(auth, schema);
  } else if (auth.type === 'oauth1') {
    return importOauth1Authentication(auth, schema);
  } else if (auth.type === 'oauth2') {
    return importOauth2Authentication(auth, schema);
  } else {
    return {};
  }
}

function importAwsV4Authentication(auth, schema) {
  if (!auth.awsv4) {
    return {};
  }

  const item = {
    type: 'iam',
    disabled: false,
    accessKeyId: 'aws-access-key',
    region: 'aws-region',
    secretAccessKey: 'aws-secret-key',
    service: 'aws-service-name',
    sessionToken: 'aws-session-token',
  };

  if (schema === POSTMAN_SCHEMA_V2_0) {
    item.accessKeyId = auth.awsv4.accessKey;
    item.region = auth.awsv4.region;
    item.secretAccessKey = auth.awsv4.secretKey;
    item.service = auth.awsv4.service;
    item.sessionToken = auth.awsv4.sessionToken;
  }

  if (schema === POSTMAN_SCHEMA_V2_1) {
    item.accessKeyId = findValueByKey(auth.awsv4, 'accessKey');
    item.region = findValueByKey(auth.awsv4, 'region');
    item.secretAccessKey = findValueByKey(auth.awsv4, 'secretKey');
    item.service = findValueByKey(auth.awsv4, 'service');
    item.sessionToken = findValueByKey(auth.awsv4, 'sessionToken');
  }

  return item;
}

function importBasicAuthentication(auth, schema) {
  if (!auth.basic) {
    return {};
  }

  const item = {
    type: 'basic',
    disabled: false,
    username: '',
    password: '',
  };

  if (schema === POSTMAN_SCHEMA_V2_0) {
    item.username = auth.basic.username;
    item.password = auth.basic.password;
  }

  if (schema === POSTMAN_SCHEMA_V2_1) {
    item.username = findValueByKey(auth.basic, 'username');
    item.password = findValueByKey(auth.basic, 'password');
  }

  return item;
}

function importBearerTokenAuthentication(auth, schema) {
  if (!auth.bearer) {
    return {};
  }

  const item = {
    type: 'bearer',
    disabled: false,
    token: '',
    prefix: '',
  };

  if (schema === POSTMAN_SCHEMA_V2_0) {
    item.token = auth.bearer.token;
  }

  if (schema === POSTMAN_SCHEMA_V2_1) {
    item.token = findValueByKey(auth.bearer, 'token');
  }

  return item;
}

function importDigestAuthentication(auth, schema) {
  if (!auth.digest) {
    return {};
  }

  const item = {
    type: 'digest',
    disabled: false,
    username: '',
    password: '',
  };

  if (schema === POSTMAN_SCHEMA_V2_0) {
    item.username = auth.digest.username;
    item.password = auth.digest.password;
  }

  if (schema === POSTMAN_SCHEMA_V2_1) {
    item.username = findValueByKey(auth.digest, 'username');
    item.password = findValueByKey(auth.digest, 'password');
  }

  return item;
}

function importOauth1Authentication(auth, schema) {
  if (!auth.oauth1) {
    return {};
  }

  const item = {
    type: 'oauth1',
    disabled: false,
    callback: '',
    consumerKey: '',
    consumerSecret: '',
    nonce: '',
    privateKey: '',
    realm: '',
    signatureMethod: '',
    timestamp: '',
    tokenKey: '',
    tokenSecret: '',
    verifier: '',
    version: '',
  };

  if (schema === POSTMAN_SCHEMA_V2_0) {
    item.consumerKey = auth.oauth1.consumerKey;
    item.consumerSecret = auth.oauth1.consumerSecret;
    item.nonce = auth.oauth1.nonce;
    item.realm = auth.oauth1.realm;
    item.signatureMethod = auth.oauth1.signatureMethod;
    item.timestamp = auth.oauth1.timestamp;
    item.tokenKey = auth.oauth1.token;
    item.tokenSecret = auth.oauth1.tokenSecret;
    item.version = auth.oauth1.version;
  }

  if (schema === POSTMAN_SCHEMA_V2_1) {
    item.consumerKey = findValueByKey(auth.oauth1, 'consumerKey');
    item.consumerSecret = findValueByKey(auth.oauth1, 'consumerSecret');
    item.nonce = findValueByKey(auth.oauth1, 'nonce');
    item.realm = findValueByKey(auth.oauth1, 'realm');
    item.signatureMethod = findValueByKey(auth.oauth1, 'signatureMethod');
    item.timestamp = findValueByKey(auth.oauth1, 'timestamp');
    item.tokenKey = findValueByKey(auth.oauth1, 'token');
    item.tokenSecret = findValueByKey(auth.oauth1, 'tokenSecret');
    item.version = findValueByKey(auth.oauth1, 'version');
  }

  return item;
}

function importOauth2Authentication(auth, schema) {
  if (!auth.oauth2) {
    return {};
  }

  // Note: Postman v2.0 and v2.1 don't export any Oauth config. They only export the token
  // So just return a disabled and empty Oauth 2 configuration so the user can fill it in later.

  const item = {
    type: 'oauth2',
    disabled: true,
    accessTokenUrl: '',
    authorizationUrl: '',
    grantType: 'authorization_code',
    password: '',
    username: '',
  };

  return item;
}

function findValueByKey(array, key) {
  if (!array) {
    return '';
  }

  const obj = array.find(o => o.key === key);
  if (obj) {
    return obj.value || '';
  }

  return '';
}
