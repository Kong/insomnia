import crypto from 'crypto';
import { format } from 'date-fns';
import fs from 'fs';
import iconv from 'iconv-lite';
import { JSONPath } from 'jsonpath-plus';
import os from 'os';
import { CookieJar } from 'tough-cookie';
import * as uuid from 'uuid';

import { Response } from '../../../models/response';
import { PluginTemplateTag } from '../../../templating/extensions';
import { invariant } from '../../../utils/invariant';

export const localTemplateTags: {
  templateTag: PluginTemplateTag;
}[] = [
  {
    templateTag: {
      name: 'base64',
      displayName: 'Base64',
      description: 'encode or decode values',
      args: [
        {
          displayName: 'Action',
          type: 'enum',
          options: [
            { displayName: 'Encode', value: 'encode' },
            { displayName: 'Decode', value: 'decode' },
          ],
        },
        {
          displayName: 'Kind',
          type: 'enum',
          options: [
            { displayName: 'Normal', value: 'normal' },
            { displayName: 'URL', value: 'url' },
          ],
        },
        {
          displayName: 'Value',
          type: 'string',
          placeholder: 'My text',
        },
      ],
      run(_context, action, kind, text) {
        text = text || '';
        invariant(action === 'encode' || action === 'decode', 'invalid action');
        if (action === 'encode') {
          if (kind === 'normal') {
            return Buffer.from(text, 'utf8').toString('base64');
          } else if (kind === 'url') {
            return Buffer.from(text, 'utf8')
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');
          }
        }
        return Buffer.from(text, 'base64').toString('utf8');
      },
    },
  },
  {
    templateTag:{
      name: 'now',
      displayName: 'Timestamp',
      description: 'get the current time',
      args: [
        {
          displayName: 'Timestamp Format',
          type: 'enum',
          options: [
            { displayName: 'ISO-8601', value: 'iso-8601' },
            { displayName: 'Milliseconds', value: 'millis' },
            { displayName: 'Unix', value: 'unix' },
            { displayName: 'Custom Format', value: 'custom' },
          ],
        },
        {
          help: 'moment.js format string',
          displayName: 'Custom Format Template',
          type: 'string',
          placeholder: 'MMMM Do YYYY, h:mm:ss a',
          hide: args => args[0].value !== 'custom',
        },
      ],
      run(_context, dateType = 'iso-8601', formatStr = '') {
        if (typeof dateType === 'string') {
          dateType = dateType.toLowerCase();
        }

        const now = new Date();

        switch (dateType) {
          case 'millis':
          case 'ms':
            return now.getTime() + '';
          case 'unix':
          case 'seconds':
          case 's':
            return Math.round(now.getTime() / 1000) + '';
          case 'iso-8601':
            return now.toISOString();
          case 'custom':
            return format(now, formatStr);
          default:
            throw new Error(`Invalid date type "${dateType}"`);
        }
      },
    },
  },
  {
    templateTag:{
      displayName: 'UUID',
      name: 'uuid',
      description: 'generate v1 or v4 UUIDs',
      args: [
        {
          displayName: 'Version',
          type: 'enum',
          options: [
            { displayName: 'Version 4', value: 'v4' },
            { displayName: 'Version 1', value: 'v1' },
          ],
        },
      ],
      run(_context, uuidType = 'v4') {
        switch ((uuidType + '').toLowerCase()) {
          case '1':
          case 'v1':
            return uuid.v1();
          case '4':
          case 'v4':
            return uuid.v4();
          default:
            throw new Error(`Invalid UUID type "${uuidType}"`);
        }
      },
    },
  },
  {
    templateTag:{
      displayName: 'OS',
      name: 'os',
      description: 'get OS info',
      args: [
        {
          displayName: 'Function',
          type: 'enum',
          options: [
            { displayName: 'arch', value: 'arch' },
            { displayName: 'cpus', value: 'cpus' },
            { displayName: 'freemem', value: 'freemem' },
            { displayName: 'hostname', value: 'hostname' },
            { displayName: 'platform', value: 'platform' },
            { displayName: 'release', value: 'release' },
            { displayName: 'userInfo', value: 'userInfo' },
          ],
        },
        {
          displayName: 'JSONPath Filter',
          help: 'Some OS functions return objects. Use JSONPath queries to extract desired values.',
          hide: args => !['userInfo', 'cpus'].includes(args[0].value + ''),
          type: 'string',
        },
      ],
      run(_context, fnName: 'arch' | 'cpus', filter) {
        let value = os[fnName]();

        if (JSONPath && ['userInfo', 'cpus'].includes(fnName)) {
          try {
            value = JSONPath({ json: value, path: filter })[0];
          } catch (err) {}
        }

        if (typeof value !== 'string') {
          return JSON.stringify(value);
        } else {
          return value;
        }
      },
    },
  },
  {
    templateTag: {
      name: 'hash',
      displayName: 'Hash',
      description: 'apply hash to a value',
      args: [
        {
          displayName: 'Algorithm',
          type: 'enum',
          options: [
            { displayName: 'MD5', value: 'md5' },
            { displayName: 'SHA1', value: 'sha1' },
            { displayName: 'SHA256', value: 'sha256' },
            { displayName: 'SHA512', value: 'sha512' },
          ],
        },
        {
          displayName: 'Digest Encoding',
          description: 'The encoding of the output',
          type: 'enum',
          options: [
            { displayName: 'Hexadecimal', value: 'hex' },
            { displayName: 'Base64', value: 'base64' },
          ],
        },
        {
          displayName: 'Input',
          type: 'string',
          placeholder: 'Value to hash',
        },
      ],
      run(_context, algorithm, encoding, value = '') {
        if (encoding !== 'hex' && encoding !== 'latin1' && encoding !== 'base64') {
          throw new Error(`Invalid encoding ${encoding}. Choices are hex, latin1, base64`);
        }

        const valueType = typeof value;
        if (valueType !== 'string') {
          throw new Error(`Cannot hash value of type "${valueType}"`);
        }

        const hash = crypto.createHash(algorithm);
        hash.update(value || '', 'utf8');
        return hash.digest(encoding);
      },
    },
  },
  {
    templateTag: {
      name: 'file',
      displayName: 'File',
      description: 'read contents from a file',
      args: [
        {
          displayName: 'Choose File',
          type: 'file',
        },
      ],
      run(_context, path) {
        if (!path) {
          throw new Error('No file selected');
        }

        return fs.readFileSync(path, 'utf8');
      },
    },
  },
  {
    templateTag: {
      displayName: 'JSONPath',
      name: 'jsonpath',
      description: 'pull data from JSON strings with JSONPath',
      args: [
        {
          displayName: 'JSON string',
          type: 'string',
        },
        {
          displayName: 'JSONPath Filter',
          encoding: 'base64', // So it doesn't cause syntax errors
          type: 'string',
        },
      ],
      run(_context, jsonString, filter) {
        let body;
        try {
          body = JSON.parse(jsonString);
        } catch (err) {
          throw new Error(`Invalid JSON: ${err.message}`);
        }

        let results;
        try {
          results = JSONPath({ json: body, path: filter });
        } catch (err) {
          throw new Error(`Invalid JSONPath query: ${filter}`);
        }

        if (results.length === 0) {
          throw new Error(`JSONPath query returned no results: ${filter}`);
        }

        return results[0];
      },
    },
  },
  {
    templateTag:  {
      name: 'cookie',
      displayName: 'Cookie',
      description: 'reference a cookie value from the cookie jar',
      args: [
        {
          type: 'string',
          displayName: 'Cookie Url',
          description: 'fully qualified URL (e.g. https://domain.tld/path)',
        },
        {
          type: 'string',
          displayName: 'Cookie Name',
        },
      ],
      async run(context, url, name) {
        const { meta } = context;

        if (!meta.requestId || !meta.workspaceId) {
          return null;
        }

        const workspace = await context.util.models.workspace.getById(meta.workspaceId);

        if (!workspace) {
          throw new Error(`Workspace not found for ${meta.workspaceId}`);
        }

        const cookieJar = await context.util.models.cookieJar.getOrCreateForWorkspace(workspace);

        return new Promise((resolve, reject) => {
          let jar;
          try {
            // For some reason, fromJSON modifies `cookies`.
            // Create a copy first just to be sure.
            const copy = JSON.stringify({ cookies:cookieJar.cookies });
            jar = CookieJar.fromJSON(copy);
          } catch (error) {
            console.log('[cookies] Failed to initialize cookie jar', error);
            jar = new CookieJar();
          }
          jar.rejectPublicSuffixes = false;
          jar.looseMode = true;

          jar.getCookies(url, {}, (err, cookies) => {
            if (err) {
              console.warn(`Failed to find cookie for ${url}`, err);
            }

            if (!cookies || cookies.length === 0) {
              console.log(cookies);
              reject(new Error(`No cookies in store for url "${url}"`));
            }

            const cookie = cookies.find(cookie => cookie.key === name);
            if (!cookie) {
              const names = cookies.map(c => `"${c.key}"`).join(',\n\t');
              throw new Error(
                `No cookie with name "${name}".\nChoices are [\n\t${names}\n] for url "${url}"`,
              );
            } else {
              resolve(cookie ? cookie.value : null);
            }
          });
        });
      },
    },
  },
  {
    templateTag:  {
      displayName: 'Prompt',
      name: 'prompt',
      description: 'prompt user for input',
      disablePreview: args => Boolean(args[4]) && args[4].value === true,
      args: [
        {
          displayName: 'Title',
          type: 'string',
          help: 'Title is a unique string used to identify the prompt value',
          validate: v => (v ? '' : 'Required'),
        },
        {
          displayName: 'Label',
          type: 'string',
        },
        {
          displayName: 'Default Value',
          type: 'string',
          help:
            'This value is used to pre-populate the prompt dialog, but is ALSO used ' +
            'when the app renders preview values (like the one below). This is to prevent the ' +
            'prompt from displaying too frequently during general app use.',
        },
        {
          displayName: 'Storage Key',
          type: 'string',
          help:
            'If this is set, the value will be stored in memory under this key until the app is ' +
            "closed. To force this tag to re-prompt the user, simply change this key's value to " +
            'something else.',
        },
        {
          displayName: 'Mask Text',
          type: 'boolean',
          help: 'If this is enabled, the value when input will be masked like a password field.',
          defaultValue: false,
        },
        {
          displayName: 'Default to Last Value',
          type: 'boolean',
          help:
            'If this is enabled, the input field will be pre-filled with this value. This option is ' +
            'ignored when the storage key is set.',
          defaultValue: true,
        },
      ],
      actions: [
        {
          name: 'Clear',
          icon: 'fa fa-trash',
          run: context => {
            console.log('[prompt] Clear action');
            return context.store.clear();
          },
        },
      ],
      async run(context, title, label, defaultValue, explicitStorageKey, maskText, saveLastValue) {
        if (!title) {
          throw new Error('Title attribute is required for prompt tag');
        }

        // If we don't have a key, default to request ID.
        // We do this because we may render the prompt multiple times per request.
        // We cache it under the requestId so it only prompts once. We then clear
        // the cache in a response hook when the request is sent.
        const titleHash = crypto
          .createHash('md5')
          .update(title)
          .digest('hex');
        const storageKey = explicitStorageKey || `${context.meta.requestId}.${titleHash}`;
        const cachedValue = await context.store.getItem(storageKey);

        // Directly return cached value if using explicitly defined storage key
        if (explicitStorageKey && cachedValue) {
          console.log(`[prompt] Used cached value under ${storageKey}`);
          return cachedValue;
        }

        // Use cached value as default value
        if (cachedValue && saveLastValue) {
          defaultValue = cachedValue;
          console.log(`[prompt] Used cached value under ${storageKey}`);
        }

        // Only prompt when we're actually sending
        if (context.renderPurpose !== 'send') {
          if (cachedValue !== null) {
            return cachedValue;
          } else {
            return defaultValue || '';
          }
        }

        const value = await context.app.prompt(title || 'Enter Value', {
          label,
          defaultValue,
          inputType: maskText ? 'password' : 'text',
        });

        if (storageKey) {
          console.log(`[prompt] Stored value under ${storageKey}`);
          await context.store.setItem(storageKey, value);
        }

        return value;
      },
    },
  },
  {
    templateTag: {
      name: 'response',
      displayName: 'Response',
      description: "reference values from other request's responses",
      args: [
        {
          displayName: 'Attribute',
          type: 'enum',
          options: [
            {
              displayName: 'Body Attribute',
              description: 'value of response body',
              value: 'body',
            },
            {
              displayName: 'Raw Body',
              description: 'entire response body',
              value: 'raw',
            },
            {
              displayName: 'Header',
              description: 'value of response header',
              value: 'header',
            },
            {
              displayName: 'Request URL',
              description: 'Url of initiating request',
              value: 'url',
            },
          ],
        },
        {
          displayName: 'Request',
          type: 'model',
          model: 'Request',
        },
        {
          type: 'string',
          encoding: 'base64',
          hide: args => !(args[0].value !== 'raw' && args[0].value !== 'url'),
          displayName: args => {
            switch (args[0].value) {
              case 'body':
                return 'Filter (JSONPath or XPath)';
              case 'header':
                return 'Header Name';
              default:
                return 'Filter';
            }
          },
        },
        {
          displayName: 'Trigger Behavior',
          help: 'Configure when to resend the dependent request',
          type: 'enum',
          defaultValue: 'never',
          options: [
            {
              displayName: 'Never',
              description: 'never resend request',
              value: 'never',
            },
            {
              displayName: 'No History',
              description: 'resend when no responses present',
              value: 'no-history',
            },
            {
              displayName: 'When Expired',
              description: 'resend when existing response has expired',
              value: 'when-expired',
            },
            {
              displayName: 'Always',
              description: 'resend request when needed',
              value: 'always',
            },
          ],
        },
        {
          displayName: 'Max age (seconds)',
          help: 'The maximum age of a response to use before it expires',
          type: 'number',
          hide: args => {
            const triggerBehavior = (args[3] && args[3].value) || 'never';
            return triggerBehavior !== 'when-expired';
          },
          defaultValue: 60,
        },
      ],

      async run(context, field, id, filter, resendBehavior, maxAgeSeconds) {
        filter = filter || '';
        resendBehavior = (resendBehavior || 'never').toLowerCase();

        if (!['body', 'header', 'raw', 'url'].includes(field)) {
          throw new Error(`Invalid response field ${field}`);
        }

        if (!id) {
          throw new Error('No request specified');
        }

        const request = await context.util.models.request.getById(id);
        if (!request) {
          throw new Error(`Could not find request ${id}`);
        }

        const environmentId = context.context.getEnvironmentId();
        let response: Response = await context.util.models.response.getLatestForRequestId(id, environmentId);

        let shouldResend = false;
        switch (resendBehavior) {
          case 'no-history':
            shouldResend = !response;
            break;

          case 'when-expired':
            if (!response) {
              shouldResend = true;
            } else {
              const ageSeconds = (Date.now() - response.created) / 1000;
              shouldResend = ageSeconds > maxAgeSeconds;
            }
            break;

          case 'always':
            shouldResend = true;
            break;

          case 'never':
          default:
            shouldResend = false;
            break;

        }

        // Make sure we only send the request once per render so we don't have infinite recursion
        const requestChain = context.context.getExtraInfo('requestChain') || [];
        if (requestChain.some((id: any) => id === request._id)) {
          console.log('[response tag] Preventing recursive render');
          shouldResend = false;
        }

        if (shouldResend && context.renderPurpose === 'send') {
          console.log('[response tag] Resending dependency');
          requestChain.push(request._id);
          response = await context.network.sendRequest(request, [
            { name: 'requestChain', value: requestChain },
          ]);
        }

        if (!response) {
          console.log('[response tag] No response found');
          throw new Error('No responses for request');
        }

        if (response.error) {
          console.log('[response tag] Response error ' + response.error);
          throw new Error('Failed to send dependent request ' + response.error);
        }

        if (!response.statusCode) {
          console.log('[response tag] Invalid status code ' + response.statusCode);
          throw new Error('No successful responses for request');
        }

        if ((field !== 'raw' && field !== 'url') && !filter) {
          throw new Error(`No ${field} filter specified`);
        }

        const sanitizedFilter = filter.trim();
        const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
        const match = response.contentType && response.contentType.match(/charset=([\w-]+)/);
        const charset = match && match.length >= 2 ? match[1] : 'utf-8';
        switch (field) {
          case 'header':
            if (!response.headers.length) {
              throw new Error('No headers available');
            }
            const header = response.headers.find(h => h.name.toLowerCase() === sanitizedFilter.toLowerCase());
            if (!header) {
              const names = response.headers.map(c => `"${c.name}"`).join(',\n\t');
              throw new Error(`No header with name "${sanitizedFilter}".\nChoices are [\n\t${names}\n]`);
            }
            return header.value;

          case 'url':
            return response.url;

          case 'raw':
            // Sometimes iconv conversion fails so fallback to regular buffer
            try {
              return iconv.decode(bodyBuffer, charset);
            } catch (err) {
              console.warn('[response] Failed to decode body', err);
              return bodyBuffer.toString();
            }

          case 'body':
            // Sometimes iconv conversion fails so fallback to regular buffer
            let body;
            try {
              body = iconv.decode(bodyBuffer, charset);
            } catch (err) {
              console.warn('[response] Failed to decode body', err);
              body = bodyBuffer.toString();
            }

            if (sanitizedFilter.indexOf('$') === 0) {
              let bodyJSON;
              let results;

              try {
                bodyJSON = JSON.parse(body);
              } catch (err) {
                throw new Error(`Invalid JSON: ${err.message}`);
              }

              try {
                results = JSONPath({ json: bodyJSON, path: sanitizedFilter });
              } catch (err) {
                throw new Error(`Invalid JSONPath query: ${sanitizedFilter}`);
              }

              if (results.length === 0) {
                throw new Error(`Returned no results: ${sanitizedFilter}`);
              }

              if (results.length > 1) {
                return JSON.stringify(results);
              }

              if (typeof results[0] !== 'string') {
                return JSON.stringify(results[0]);
              } else {
                return results[0];
              }
            } else {
              const DOMParser = (await import('xmldom')).DOMParser;
              const dom = new DOMParser().parseFromString(body);
              let selectedValues = [];
              if (sanitizedFilter === undefined) {
                throw new Error('Must pass an XPath query.');
              }
              try {
                selectedValues = (await import('xpath')).select(sanitizedFilter, dom);
                console.log(selectedValues);

              } catch (err) {
                throw new Error(`Invalid XPath query: ${sanitizedFilter}`);
              }
              const results = [];
              // Functions return plain strings
              if (typeof selectedValues === 'string') {
                results.push({
                  outer: selectedValues,
                  inner: selectedValues,
                });
              } else {
                for (const selectedValue of selectedValues || []) {
                  switch (selectedValue.constructor.name) {
                    case 'Attr':
                      results.push({
                        outer: selectedValue.toString().trim(),
                        inner: selectedValue.nodeValue,
                      });
                      break;

                    case 'Element':
                      results.push({
                        outer: selectedValue.toString().trim(),
                        inner: selectedValue.childNodes.toString(),
                      });
                      break;

                    case 'Text':
                      results.push({
                        outer: selectedValue.toString().trim(),
                        inner: selectedValue.toString().trim(),
                      });
                      break;

                    default:
                      break;
                  }
                }
              }

              if (results.length === 0) {
                throw new Error(`Returned no results: ${sanitizedFilter}`);
              } else if (results.length > 1) {
                throw new Error(`Returned more than one result: ${sanitizedFilter}`);
              }

              return results[0].inner;
            }

          default:
            throw new Error(`Unknown field ${field}`);
        }
      },
    },
  },
];
