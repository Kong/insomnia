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
    } else {
      // Null or undefined
      version = 'v4';
    }

    switch (version) {
      case '1':
      case 'v1':
        return uuid.v1();
      case '4':
      case 'v4':
        return uuid.v4();
      default:
        throw new Error(`Invalid UUID type ${version}`);
    }
  }
}
