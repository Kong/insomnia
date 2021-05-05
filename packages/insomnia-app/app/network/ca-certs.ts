// NOTE: this file is used by the `val-loader` webpack loader to export the NodeJS trust store during compile time.
import tls from 'tls';

const caCert = () => {
  return {
    code: 'module.exports = `' + tls.rootCertificates.join('\n') + '`',
  };
};

export default caCert;
