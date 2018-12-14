const moment = require('moment');

module.exports.templateTags = [
  {
    name: 'now',
    displayName: 'Timestamp',
    description: 'get the current time',
    args: [
      {
        displayName: 'Timestamp Format',
        type: 'enum',
        options: [
          { displayName: 'ISO-8601', value: 'iso-8601' },
          { displayName: 'Milliseconds', value: 'millis' },
          { displayName: 'Unix', value: 'unix' },
          { displayName: 'Custom Format', value: 'custom' },
        ],
      },
      {
        help: 'moment.js format string',
        displayName: 'Custom Format Template',
        type: 'string',
        placeholder: 'MMMM Do YYYY, h:mm:ss a',
        hide: args => args[0].value !== 'custom',
      },
    ],
    run(context, dateType = 'iso-8601', formatStr = '') {
      if (typeof dateType === 'string') {
        dateType = dateType.toLowerCase();
      }

      const now = new Date();

      switch (dateType) {
        case 'millis':
        case 'ms':
          return now.getTime() + '';
        case 'unix':
        case 'seconds':
        case 's':
          return Math.round(now.getTime() / 1000) + '';
        case 'iso-8601':
          return now.toISOString();
        case 'custom':
          return moment(now).format(formatStr);
        default:
          throw new Error(`Invalid date type "${dateType}"`);
      }
    },
  },
  {
    // Old deprecated "timestamp" tag
    deprecated: true,
    name: 'timestamp',
    displayName: 'Timestamp',
    description: 'generate timestamp in milliseconds',
    run(context) {
      return Date.now();
    },
  },
];
