import BaseExtension from './base/base-extension';

export default class TimestampExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['timestamp'];
  }

  run (context) {
    return Date.now();
  }
}
