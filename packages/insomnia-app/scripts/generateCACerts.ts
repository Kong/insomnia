import fs from 'fs/promises';
import path from 'path';
import tls from 'tls';

fs.writeFile(
  path.join(__dirname, '..', 'app', 'network', 'ca_certs.ts'),
  `export default \`${tls.rootCertificates.join('\n')}\``
);
