import BaseExtension from './base/BaseExtension';

export default class NowExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['now'];
  }

  run (context, format = 'iso-8601') {
    if (typeof format === 'string') {
      format = format.toLowerCase();
    }

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
        return now.toISOString();
      default:
        throw new Error(`Invalid date format ${format}`);
    }
  }
}
