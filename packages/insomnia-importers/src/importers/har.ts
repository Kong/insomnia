import { UNKNOWN, ImportRequest, PostData, Body, Converter } from '../entities';

export const id = 'har';
export const name = 'HAR 1.2';
export const description = 'Importer for HTTP Archive 1.2';

let requestCount = 1;

interface Entry {
  comment: UNKNOWN;
  request: ImportRequest;
}

interface HarRoot {
  log: {
    entries: Entry[];
  };
  httpVersion: UNKNOWN;
  method: UNKNOWN;
  url: UNKNOWN;
}

const extractRequests = (harRoot: HarRoot): ImportRequest[] => {
  const { log, httpVersion, method, url } = harRoot;

  if (!log && httpVersion && method && url) {
    // If there is not "log" property, try to use the root object if it looks like a request
    return [harRoot];
  }

  return log.entries.map(({ comment, request }) => {
    if (comment && request && !request.comment) {
      // Preserve the entry comment for request name generation
      request.comment = comment;
    }
    return request;
  });
};

const removeComment = <T extends { comment?: UNKNOWN }>(obj: T) => {
  const { comment, ...newObject } = obj;
  return newObject;
};

const importPostData = (postData?: PostData): Body => {
  if (!postData) {
    return {};
  }

  const { params, mimeType = '', text = '' } = postData;

  if (params && params.length) {
    return {
      mimeType: mimeType || 'application/x-www-form-urlencoded',
      params: params.map(({ name, fileName, value = '' }) => ({
        name,
        ...(fileName ? { fileName } : { value }),
      })),
    };
  } else {
    return {
      mimeType,
      text,
    };
  }
};

const importRequest = (request: ImportRequest): ImportRequest => {
  const cookieHeaderValue = (request.cookies ?? [])
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const headers = request.headers ? request.headers.map(removeComment) : [];

  // Convert cookie value to header
  const existingCookieHeader = headers.find(
    (header) => header.name.toLowerCase() === 'cookie',
  );

  if (cookieHeaderValue && existingCookieHeader) {
    // Has existing cookie header, so let's update it
    existingCookieHeader.value += `; ${cookieHeaderValue}`;
  } else if (cookieHeaderValue) {
    // No existing cookie header, so let's make a new one
    headers.push({
      name: 'Cookie',
      value: cookieHeaderValue,
    });
  }

  const count = requestCount++;
  return {
    _type: 'request',
    _id: `__REQ_${count}__`,
    name: request.comment || request.url || `HAR Import ${count}`,
    parentId: '__WORKSPACE_ID__',
    url: request.url,
    method: request.method?.toUpperCase(),
    body: importPostData(request.postData),
    parameters: request.queryString
      ? request.queryString.map(removeComment)
      : [],
    headers: headers,
    // Authentication isn't part of HAR, but we should be able to sniff for things like Basic Authentication headers and pull out the auth info
    authentication: {},
  };
};

export const convert: Converter = (rawData) => {
  requestCount = 1;

  try {
    const data = JSON.parse(rawData);
    const requests = extractRequests(data);
    return requests.map(importRequest);
  } catch (error) {
    return null;
  }
};
