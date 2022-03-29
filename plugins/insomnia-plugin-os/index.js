const os = require('os');
const {JSONPath} = require('jsonpath-plus');

const FILTERABLE = ['userInfo', 'cpus'];

module.exports.templateTags = [
  {
    displayName: 'OS',
    name: 'os',
    description: 'get OS info',
    args: [
      {
        displayName: 'Function',
        type: 'enum',
        options: [
          { displayName: 'arch', value: 'arch' },
          { displayName: 'cpus', value: 'cpus' },
          { displayName: 'freemem', value: 'freemem' },
          { displayName: 'hostname', value: 'hostname' },
          { displayName: 'platform', value: 'platform' },
          { displayName: 'release', value: 'release' },
          { displayName: 'userInfo', value: 'userInfo' },
        ],
      },
      {
        displayName: 'JSONPath Filter',
        help: 'Some OS functions return objects. Use JSONPath queries to extract desired values.',
        hide: args => !FILTERABLE.includes(args[0].value),
        type: 'string',
      },
    ],
    run(context, fnName, filter) {
      let value = os[fnName]();

      if (jsonPath && FILTERABLE.includes(fnName)) {
        try {
          value = JSONPath({json: value, path: filter})[0];
        } catch (err) {}
      }

      if (typeof value !== 'string') {
        return JSON.stringify(value);
      } else {
        return value;
      }
    },
  },
];
