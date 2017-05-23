import BaseExtension from './base/base-extension';

export default class NowExtension extends BaseExtension {
  getName () {
    return 'Now';
  }

  getTag () {
    return 'now';
  }

  getDefaultFill () {
    return "now 'iso-8601'";
  }

  getDescription () {
    return 'get the current time';
  }

  getArguments () {
    return [{
      key: 'format',
      label: 'Timestamp Format',
      type: 'enum',
      options: [
        {name: 'Milliseconds', value: 'millis'},
        {name: 'Unix Timestamp', value: 'unix'},
        {name: 'ISO-8601 Format', value: 'iso-8601'}
      ]
    }];
  }

  run (context, dateType = 'iso-8601') {
    if (typeof dateType === 'string') {
      dateType = dateType.toLowerCase();
    }

    const now = new Date();

    switch (dateType) {
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
        throw new Error(`Invalid date type "${dateType}"`);
    }
  }
}
