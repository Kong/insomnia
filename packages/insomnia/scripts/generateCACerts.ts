import fs from 'fs/promises';
import path from 'path';
import tls from 'tls';

const filePath = path.join(__dirname, '..', 'src', 'network', 'ca_certs.ts');

const certificates = tls.rootCertificates.join('\n');
const fileContents = `export default \`${certificates}\`;\n`;

fs.writeFile(filePath, fileContents);
