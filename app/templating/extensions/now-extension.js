export default {
  name: 'now',
  displayName: 'Now Timestamp',
  description: 'get the current time',
  defaultFill: "now 'iso-8601'",
  args: [{
    displayName: 'Timestamp Format',
    type: 'enum',
    options: [
      {displayName: 'ISO-8601', value: 'iso-8601'},
      {displayName: 'Milliseconds', value: 'millis'},
      {displayName: 'Unix', value: 'unix'}
    ]
  }],
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
};
