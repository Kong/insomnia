import BaseExtension from './base/BaseExtension';

export default class NowExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['now'];
  }

  run (context, format = 'iso-8601') {
    format = typeof format === 'string' ? format.toLowerCase() : 'unknown';
    const now = new Date();

    switch (format) {
      case 'millis':
      case 'ms':
        return now.getTime();
      case 'unix':
      case 'seconds':
      case 's':
        return Math.round(now.getTime() / 1000);
      case 'iso-8601':
      default:
        return now.toISOString();
    }
  }
}
