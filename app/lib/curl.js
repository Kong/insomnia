'use strict';

import render from './render';
import * as querystring from './querystring';
import * as db from '../database';
import {DEBOUNCE_MILLIS} from "./constants";
import {METHOD_GET} from "./constants";

const FLAGS = [
  'cacert', 'capath', 'E', 'cert', 'cert-type', 'ciphers', 'K', 'config',
  'connect-timeout', 'C', 'continue-at', 'b',
  'cookie', // TODO: Handle this
  'c', 'cookie-jar', 'crlfile', 'd', 'data', 'data-ascii', 'data-binary',
  'data-urlencode', 'delegation', 'D', 'dump-header', 'egd-file',
  'engine', 'F', 'form', 'form-string', 'ftp-account', 'ftp-method',
  'ftp-port', 'H', 'header', 'hostpubmd5', 'interface', 'keepalive-time',
  'key', 'key-type', 'krb', 'lib-curl', 'limit-rate', 'local-port',
  'mail-from', 'mail-rcpt', 'mail-auth', 'max-filesize', 'max-redirs',
  'max-time', 'netrtc-file', 'output', 'pass', 'proto', 'proto-redir',
  'proxy', 'proxy-user', 'proxy1.0', 'pubkey', 'Q', 'quote',
  'random-file', 'range', 'X', 'request', 'resolve', 'retry',
  'retry-delay', 'retry-max-time', 'socks4', 'socks4a', 'socks5',
  'socks5-hostname', 'socks5-gssapi-service', 'Y', 'speed-limit',
  'y', 'speed-time', 'stderr', 'tftp-blksize', 'z', 'time-cond', 'trace',
  'trace-ascii', 'T', 'upload-file',
  'url', // TODO: Handle this
  'u', 'user', 'tlsuser', 'tlspassword', 'tlsauthtype',
  'A', 'user-agent', // TODO: Handle this
  'w', 'write-out'
];

const FLAG_REGEXES = [
  /\s--([\w\-]{2,})\s+"((?:[^"\\]|\\.)*)"/, // --my-flag "hello"
  /\s--([\w\-]{2,})\s+'((?:[^'\\]|\\.)*)'/, // --my-flag 'hello'
  /\s--([\w\-]{2,})\s+([^\s]+)/,            // --my-flag hello
  /\s-([\w])\s*'((?:[^'\\]|\\.)*)'/,        // -X 'hello'
  /\s-([\w])\s*"((?:[^"\\]|\\.)*)"/,        // -X "hello"
  /\s-([\w])\s*([^\s]+)/,                   // -X hello
  /\s--([\w\-]+)/                           // --switch (cleanup at the end)
];

function getFlags (cmd) {
  const flags = {};
  const switches = {};

  for (var i = 0; i < FLAG_REGEXES.length; i++) {
    var matches = [];
    var match;
    var key;
    var val;
    var matchedFlag;

    // Stop at 1000 to prevent infinite loops
    // TODO: Make this recursive
    for (var j = 0; (matches = FLAG_REGEXES[i].exec(cmd)); j++) {
      if (j > 1000) {
        console.error('INFINITE LOOP');
        break;
      }

      match = matches[0];
      key = matches[1];
      val = matches[2];
      matchedFlag = !!val;

      if (matchedFlag) {
        if (isFlag(key)) {
          // Matched a flag
          flags[key] = flags[key] || [];
          flags[key].push(val);
          cmd = cmd.replace(match, '');
        } else {
          // Matched a flag that was actually a switch
          cmd = cmd.replace('--' + key, '');
        }
      } else {
        // Matched a switch directly without a value
        switches[key] = true;
        cmd = cmd.replace(match, '');
      }
    }
  }

  return {cmd, flags, switches};
}

function isFlag (key) {
  for (var i = 0; i < FLAGS.length; i++) {
    if (key === FLAGS[i]) {
      return true;
    }
  }
  return false;
}

function splitHeaders (flags) {
  var headers = (flags['H'] || []).concat(flags['header'] || []);
  var parsed = [];

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i].split(':');
    var name = header[0].trim();
    var value = header[1].trim();

    parsed.push({name: name, value: value});
  }

  return parsed;
}

function getContentType (headers) {
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (header.name.toLowerCase() === 'content-type') {
      return header.value;
    }
  }
  return null;
}

function getHttpMethod (flags, hasBody) {
  var method = (flags['X'] || flags['request'] || [])[0];

  // If there is no method specified, but there is a body, default
  // to POST, else default to GET
  if (!method) {
    method = hasBody ? 'POST' : 'GET';
  }

  return method;
}

function getBasicAuth (flags) {
  var authString = flags.u || flags.user;
  var auth = {
    username: '',
    password: ''
  };

  if (authString) {
    var authSplit = authString[0].split(':');
    auth.username = (authSplit[0] || '').trim();
    auth.password = (authSplit[1] || '').trim();
  }

  return auth;
}

export function exportCurl (requestId) {
  return new Promise((resolve, reject) => {

    // First, lets wait for all debounces to finish
    setTimeout(() => {
      db.requestById(requestId).then(request => {
        db.requestGroupById(request.parentId).then(requestGroup => {
          const renderCtx = requestGroup ? requestGroup.environment : {};

          // Build the querystring
          const paramsString = JSON.stringify(request.params);
          const params = JSON.parse(render(paramsString, renderCtx));
          const qs = querystring.buildFromParams(params);

          // Build the Url
          const url = querystring.joinURL(request.url, qs);
          const IS_GET_REQUEST = request.method.toUpperCase() === METHOD_GET.toUpperCase();

          let cmd = 'curl';

          // HTTP method
          if (!IS_GET_REQUEST) {
            cmd += ` -X ${request.method.toUpperCase()}`;
          }

          // Url
          cmd += ` '${url.replace(`'`, `'"'"'`)}'`;

          // Payload
          if (request.body) {
            cmd += ` \\\n -d '${request.body.replace(`'`, `'"'"'`)}'`;
          }

          // Basic auth
          const {username, password} = request.authentication;
          if (username || password) {
            cmd += ` \\\n -u ${username}:${password}`;
          }

          // Headers
          const hasContentTypeHeader = !!request.headers.find(h => h.name.toUpperCase() === 'CONTENT-TYPE');

          if (!hasContentTypeHeader && !IS_GET_REQUEST) {
            const value = request.contentType;
            const name = 'Content-Type';

            request.headers.push({name, value})
          }

          for (let i = 0; i < request.headers.length; i++) {
            const {name, value} = request.headers[i];

            if (!name) {
              // Don't add headers with no name
              continue;
            }

            cmd += ` \\\n -H '${name}: ${value}'`;
          }

          resolve(render(cmd, renderCtx));
        });
      });
    }, DEBOUNCE_MILLIS);
  });
}

export function importCurl (blob) {
  if (!blob || blob.toLowerCase().indexOf('curl ') !== 0) {
    return false;
  }

  // Rip out the flags
  let {cmd, flags, switches} = getFlags(blob);

  // Final values
  const headers = splitHeaders(flags);

  let body = (
      flags.d ||
      flags.data ||
      flags['data-binary'] ||
      flags['data-ascii'] ||
      []
    )[0] || '';

  const contentType = getContentType(headers) || null;

  if (contentType.toLowerCase() === 'application/json') {
    try {
      body = JSON.stringify(JSON.parse(body), null, '\t');
    } catch (e) {
    }
  }

  const httpMethod = getHttpMethod(flags, !!body);
  const authentication = getBasicAuth(flags);

  // Clean up the remaining URL
  cmd = (cmd + ' ')
    .replace(/\\ /g, ' ').replace(/ \\/g, ' ')  // slashes
    .replace(/\s/g, ' ')                        // whitespaces
    .replace(/ "/g, ' ').replace(/" /g, ' ')    // double-quotes
    .replace(/ '/g, ' ').replace(/' /g, ' ');   // single-quotes

  const url = /curl\s+['"]?((?!('|")).*)['"]?/.exec(cmd)[1].trim();

  return {
    url: url,
    body: body,
    headers: headers,
    contentType: contentType,
    method: httpMethod,
    authentication: authentication
  };
}
