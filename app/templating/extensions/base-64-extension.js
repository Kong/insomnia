import BaseExtension from './base/base-extension';

export default class Base64Extension extends BaseExtension {
  getTagName () {
    return 'base64';
  }

  getArguments () {
    return [
      {
        name: 'action',
        type: 'enum',
        options: ['encode', 'decode']
      },
      {
        name: 'value',
        type: 'string'
      }
    ];
  }

  run (context, op, text) {
    text = text || '';

    if (op === 'encode') {
      return Buffer.from(text, 'utf8').toString('base64');
    } else if (op === 'decode') {
      return Buffer.from(text, 'base64').toString('utf8');
    } else {
      throw new Error('Unsupported operation "' + op + '". Must be encode or decode.');
    }
  }
}
