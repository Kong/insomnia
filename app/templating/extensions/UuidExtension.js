import uuid from 'uuid';
import BaseExtension from './base/BaseExtension';

export default class UuidExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['uuid'];
  }

  run (context, version) {
    if (typeof version === 'number') {
      version += '';
    } else if (typeof version === 'string') {
      version = version.toLowerCase();
    }

    switch (version) {
      case '1':
      case 'v1':
        return uuid.v1();
      case '4':
      case 'v4':
      default:
        return uuid.v4();
    }
  }
}
