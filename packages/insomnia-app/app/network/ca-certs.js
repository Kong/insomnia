// NOTE: this file is used by the `val-loader` webpack loader to export the NodeJS trust store during compile time.
// Do not convert it to TypeScript.  It's a native node module by design.
const tls = require('tls');

module.exports = () => {
  return {
    code: 'module.exports = `' + tls.rootCertificates.join('\n') + '`',
  };
};
