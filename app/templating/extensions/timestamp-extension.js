import BaseExtension from './base/base-extension';

export default class TimestampExtension extends BaseExtension {
  getTagName () {
    return 'timestamp';
  }

  getArguments () {
    return [];
  }

  run (context) {
    return Date.now();
  }
}
