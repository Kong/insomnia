'use strict';

let requestCount = 1;

module.exports.id = 'har';
module.exports.name = 'HAR 1.2';
module.exports.description = 'Importer for HTTP Archive 1.2';

module.exports.convert = function(rawData) {
  requestCount = 1;

  let data;
  try {
    data = JSON.parse(rawData);
    const requests = extractRequests(data);
    return requests.map(importRequest);
  } catch (e) {
    return null;
  }
};

function importRequest(request) {
  const cookieHeaderValue = mapImporter(request.cookies, importCookieToHeaderString).join('; ');
  const headers = mapImporter(request.headers, importHeader);

  // Convert cookie value to header
  const existingCookieHeader = headers.find(h => h.name.toLowerCase() === 'cookie');
  if (cookieHeaderValue && existingCookieHeader) {
    // Has existing cookie header, so let's update it
    existingCookieHeader.value += `; ${cookieHeaderValue}`;
  } else if (cookieHeaderValue) {
    // No existing cookie header, so let's make a new one
    headers.push({ name: 'Cookie', value: cookieHeaderValue });
  }

  const count = requestCount++;

  return {
    _type: 'request',
    _id: `__REQ_${count}__`,
    name: request.comment || request.url || `HAR Import ${count}`,
    parentId: '__WORKSPACE_ID__',
    url: importUrl(request.url),
    method: importMethod(request.method),
    body: importPostData(request.postData),
    parameters: mapImporter(request.queryString, importQueryString),
    headers: headers,

    // Authentication isn't part of HAR, but we should be able to
    // sniff for things like Basic Authentication headers and pull
    // out the auth info
    authentication: {},
  };
}

function importUrl(url) {
  return url;
}

function importMethod(method) {
  return method.toUpperCase();
}

function importCookieToHeaderString(obj) {
  return `${obj.name}=${obj.value}`;
}

function importHeader(obj) {
  return removeComment(obj);
}

function importQueryString(obj) {
  return removeComment(obj);
}

function importPostData(obj) {
  if (!obj) {
    return {};
  }

  if (obj.params && obj.params.length) {
    const mimeType = obj.mimeType || 'application/x-www-form-urlencoded';
    const params = obj.params.map(p => {
      const item = { name: p.name };
      if (p.fileName) {
        item.fileName = p.fileName;
      } else {
        item.value = p.value || '';
      }
      return item;
    });

    return { params, mimeType };
  } else {
    return {
      mimeType: obj.mimeType || '',
      text: obj.text || '',
    };
  }
}

function removeComment(obj) {
  const newObj = Object.assign({}, obj);
  delete newObj.comment;
  return newObj;
}

function mapImporter(arr, importFn) {
  if (!arr) {
    return [];
  } else {
    return arr.map(importFn);
  }
}

function extractRequests(harRoot) {
  const requests = [];

  const log = harRoot.log;
  if (!log && harRoot.httpVersion && harRoot.method && harRoot.url) {
    // If there is not "log" property, try to use the root object
    // if it looks like a request
    requests.push(harRoot);
    return requests;
  }

  for (const entry of log.entries) {
    if (entry.comment && entry.request && !entry.request.comment) {
      // Preserve the entry comment for request name generation
      entry.request.comment = entry.comment;
    }

    requests.push(entry.request);
  }

  return requests;
}
