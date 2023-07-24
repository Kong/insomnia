import { format } from 'date-fns';
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
];
