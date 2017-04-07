import BaseExtension from './base/base-extension';

export default class Base64Extension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['base64'];
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
