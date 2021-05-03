import tls from 'tls';

// Used by val-loader to export the NodeJS trust store during compile time
export default () => ({
  code: 'module.exports = `' + tls.rootCertificates.join('\n') + '`',
});
