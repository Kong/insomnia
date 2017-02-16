import BaseExtension from './base/BaseExtension';

export default class NowExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['now'];
  }

  run (context, format = 'iso') {
    format = typeof format === 'string' ? format.toLowerCase() : 'unknown';
    const now = new Date();

    switch (format) {
      case 'millis':
        return now.getTime();
      case 'unix':
      case 'seconds':
        return Math.round(now.getTime() / 1000);
      case 'iso':
      default:
        return now.toISOString();
    }
  }
}
