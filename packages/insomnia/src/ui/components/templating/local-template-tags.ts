import crypto from 'crypto';
import { format } from 'date-fns';
import fs from 'fs';
import { JSONPath } from 'jsonpath-plus';
import os from 'os';
import * as uuid from 'uuid';

import { TemplateTag } from '../../../plugins';
export const localTemplateTags: TemplateTag[] = [
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
      run(context, action, kind, text) {
        text = text || '';

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
        } else if (action === 'decode') {
          return Buffer.from(text, 'base64').toString('utf8');
        } else {
          throw new Error('Unsupported operation "' + action + '". Must be encode or decode.');
        }
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
      run(context, dateType = 'iso-8601', formatStr = '') {
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
      run(context, uuidType = 'v4') {
        if (typeof uuidType === 'number') {
          uuidType += '';
        } else if (typeof uuidType === 'string') {
          uuidType = uuidType.toLowerCase();
        }

        switch (uuidType) {
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
          hide: args => !['userInfo', 'cpus'].includes(args[0].value),
          type: 'string',
        },
      ],
      run(context, fnName, filter) {
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
      run(context, algorithm, encoding, value = '') {
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
      run(context, path) {
        if (!path) {
          throw new Error('No file selected');
        }

        return fs.readFileSync(path, 'utf8');
      },
    },
  },
];
