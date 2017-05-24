import uuid from 'uuid';
import BaseExtension from './base/base-extension';

export default class UuidExtension extends BaseExtension {
  getName () {
    return 'UUID';
  }

  getTag () {
    return 'uuid';
  }

  getDefaultFill () {
    return "uuid 'v4'";
  }

  getDescription () {
    return 'generate v1 or v4 UUIDs';
  }

  getArguments () {
    return [{
      key: 'version',
      label: 'Version',
      type: 'enum',
      options: [
        {value: 'v4', name: 'Version 4'},
        {value: 'v1', name: 'Version 1'}
      ]
    }];
  }

  run (context, uuidType = 'v4') {
    if (typeof uuidType === 'number') {
      uuidType += '';
    } else if (typeof uuidType === 'string') {
      uuidType = uuidType.toLowerCase();
    }

    switch (uuidType) {
      case '1':
      case 'v1':
        return uuid.v1();
      case '4':
      case 'v4':
        return uuid.v4();
      default:
        throw new Error(`Invalid UUID type "${uuidType}"`);
    }
  }
}
