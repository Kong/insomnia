// NOTE: this file is used by the `val-loader` webpack loader to export the NodeJS trust store during compile time.
import tls from 'tls';

const caCerts = () => {
  return {
    code: 'module.exports = `' + tls.rootCertificates.join('\n') + '`',
  };
};

export default caCerts;
