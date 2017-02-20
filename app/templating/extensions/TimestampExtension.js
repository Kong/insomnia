import BaseExtension from './base/BaseExtension';

export default class TimestampExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['timestamp'];
  }

  run (context) {
    return Date.now();
  }
}
