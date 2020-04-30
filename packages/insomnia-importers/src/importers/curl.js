'use strict';

const { parse } = require('shell-quote');
const { URL } = require('url');

let requestCount = 1;

module.exports.id = 'curl';
module.exports.name = 'cURL';
module.exports.description = 'cURL command line tool';

const SUPPORTED_ARGS = [
  'url',
  'u',
  'user',
  'header',
  'H',
  'cookie',
  'b',
  'get',
  'G',
  'd',
  'data',
  'data-raw',
  'data-urlencode',
  'data-binary',
  'data-ascii',
  'form',
  'F',
  'request',
  'X',
];

module.exports.convert = function(rawData) {
  requestCount = 1;

  if (!rawData.match(/^\s*curl /)) {
    return null;
  }

  const requests = [];

  // Parse the whole thing into one big tokenized list
  const allArgs = parse(rawData);

  // ~~~~~~~~~~~~~~~~~~~~~~ //
  // Aggregate the commands //
  // ~~~~~~~~~~~~~~~~~~~~~~ //

  const commands = [];

  let currentCommand = [];
  for (const arg of allArgs) {
    if (typeof arg === 'object' && arg.op === ';') {
      commands.push(currentCommand);
      currentCommand = [];
    } else if (typeof arg === 'object' && arg.op.length > 1 && arg.op.indexOf('$') === 0) {
      if (arg.op[1] === "'") {
        // Handle the case where literal like -H $'Header: \'Some Quoted Thing\''
        const str = arg.op.slice(2, arg.op.length - 1).replace(/\\'/g, "'");
        currentCommand.push(str);
      }
    } else if (typeof arg === 'object' && arg.op === 'glob') {
      currentCommand.push(arg.pattern);
    } else if (typeof arg === 'object') {
      // Not sure what this could be, so just skip it
    } else {
      currentCommand.push(arg);
    }
  }

  // Push the last unfinished command
  commands.push(currentCommand);

  for (const args of commands) {
    if (args[0] !== 'curl') {
      continue;
    }

    requests.push(importArgs(args));
  }

  return requests;
};

function importArgs(args) {
  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Collect all the flags //
  // ~~~~~~~~~~~~~~~~~~~~~ //

  const pairs = {};
  const singletons = [];

  // Start at 1 so we can skip the ^curl part
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.match(/^-{1,2}[\w-]+/)) {
      const isSingleDash = arg[0] === '-' && arg[1] !== '-';
      let name = arg.replace(/^-{1,2}/, '');

      if (!SUPPORTED_ARGS.includes(name)) {
        continue;
      }

      let value;
      if (isSingleDash && name.length > 1) {
        // Handle squished arguments like -XPOST
        value = name.slice(1);
        name = name.slice(0, 1);
      } else if (args[i + 1] && args[i + 1].indexOf('-') !== 0) {
        // Next arg is not a flag, so assign it as the value
        value = args[i + 1];
        i++; // Skip next one
      } else {
        value = true;
      }

      if (!pairs[name]) {
        pairs[name] = [value];
      } else {
        pairs[name].push(value);
      }
    } else if (arg) {
      singletons.push(arg);
    }
  }

  // ~~~~~~~~~~~~~~~~~ //
  // Build the request //
  // ~~~~~~~~~~~~~~~~~ //

  // Url & parameters
  let parameters = [];
  let url = '';

  try {
    const urlObject = new URL(getPairValue(pairs, singletons[0] || '', 'url'));
    parameters = Array.from(urlObject.searchParams.entries()).map(([key, value]) => ({
      name: key,
      value,
      disabled: false,
    }));
    url = urlObject.href.replace(urlObject.search, '').replace(/\/$/, '');
  } catch (err) {}

  // Authentication
  const [username, password] = getPairValue(pairs, '', 'u', 'user').split(/:(.*)$/);
  const authentication = username ? { username: username.trim(), password: password.trim() } : {};

  // Headers
  const headers = [...(pairs.header || []), ...(pairs.H || [])].map(str => {
    const [name, value] = str.split(/:(.*)$/);
    return { name: name.trim(), value: value.trim() };
  });

  // Cookies
  const cookieHeaderValue = [...(pairs.cookie || []), ...(pairs.b || [])]
    .map(str => {
      const name = str.split('=', 1)[0];
      const value = str.replace(`${name}=`, '');
      return `${name}=${value}`;
    })
    .join('; ');

  // Convert cookie value to header
  const existingCookieHeader = headers.find(h => h.name.toLowerCase() === 'cookie');
  if (cookieHeaderValue && existingCookieHeader) {
    // Has existing cookie header, so let's update it
    existingCookieHeader.value += `; ${cookieHeaderValue}`;
  } else if (cookieHeaderValue) {
    // No existing cookie header, so let's make a new one
    headers.push({ name: 'Cookie', value: cookieHeaderValue });
  }

  // Body (Text or Blob)
  const bodyAsGET = getPairValue(pairs, false, 'G', 'get');

  let textBodyParams = [];
  const paramNames = ['d', 'data', 'data-raw', 'data-urlencode', 'data-binary', 'data-ascii'];

  for (const paramName of paramNames) {
    const pair = pairs[paramName];
    if (pair && pair.length) {
      textBodyParams = textBodyParams.concat(pair);
    }
  }
  // join params to make body
  const textBody = textBodyParams.join('&');

  const contentTypeHeader = headers.find(h => h.name.toLowerCase() === 'content-type');
  const mimeType = contentTypeHeader ? contentTypeHeader.value.split(';')[0] : null;

  // Body (Multipart Form Data)
  const formDataParams = [...(pairs.form || []), ...(pairs.F || [])].map(str => {
    const [name, value] = str.split('=');
    const item = { name };

    if (value.indexOf('@') === 0) {
      item.fileName = value.slice(1);
      item.type = 'file';
    } else {
      item.value = value;
      item.type = 'text';
    }
    return item;
  });

  // Body
  const body = mimeType ? { mimeType: mimeType } : {};
  if (textBody && bodyAsGET) {
    const bodyParams = textBody.split('&').map(v => {
      const [name, value] = v.split('=');
      return { name: name || '', value: value || '' };
    });

    parameters.push(...bodyParams);
  } else if (textBody && mimeType === 'application/x-www-form-urlencoded') {
    body.params = textBody.split('&').map(v => {
      const [name, value] = v.split('=');
      return { name: name || '', value: value || '' };
    });
  } else if (textBody) {
    body.text = textBody;
    body.mimeType = mimeType || '';
  } else if (formDataParams.length) {
    body.params = formDataParams;
    body.mimeType = mimeType || 'multipart/form-data';
  }

  // Method
  let method = getPairValue(pairs, '__UNSET__', 'X', 'request').toUpperCase();
  if (method === '__UNSET__') {
    method = body.text || body.params ? 'POST' : 'GET';
  }

  const count = requestCount++;
  return {
    _id: `__REQ_${count}__`,
    _type: 'request',
    parentId: '__WORKSPACE_ID__',
    name: url || `cURL Import ${count}`,
    parameters,
    url,
    method,
    headers,
    authentication,
    body,
  };
}

function getPairValue(pairs, defaultValue, ...names) {
  for (const name of names) {
    if (pairs[name] && pairs[name].length) {
      return pairs[name][0];
    }
  }
  return defaultValue;
}
