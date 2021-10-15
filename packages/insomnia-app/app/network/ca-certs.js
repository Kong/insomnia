// NOTE: this file is used by the `val-loader` webpack loader to export the NodeJS trust store during compile time.
// Do not convert it to TypeScript.  It's a native node module by design.
require('linux-ca');
require('mac-ca');
require('win-ca');
const https = require('https');

module.exports = () => {
  return {
    code: 'module.exports = `' + https.globalAgent.options.ca.join('\n') + '`',
  };
};
