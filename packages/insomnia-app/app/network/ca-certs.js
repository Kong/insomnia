const tls = require('tls');

// Used by val-loader to export the NodeJS trust store during compile time
module.exports = () => {
  return {
    code: 'module.exports = `' + tls.rootCertificates.join('\n') + '`',
  };
};
