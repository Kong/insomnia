// Asserts that a node_libcurl.node binary links the expected OpenSSL version.
//
//   node scripts/check-binary-version.js <path-to-node_libcurl.node> [expected-version]

'use strict';

const fs = require('fs');

const [, , binaryPath, expected = '3.5.9'] = process.argv;

if (!binaryPath) {
  console.error('usage: node scripts/check-binary-version.js <path-to-node_libcurl.node> [expected-version]');
  process.exit(2);
}
if (!fs.existsSync(binaryPath)) {
  console.error(`binary not found: ${binaryPath}`);
  process.exit(1);
}

const contents = fs.readFileSync(binaryPath).toString('latin1');
const libcurl = [...new Set(contents.match(/libcurl\/\d+\.\d+\.\d+[A-Z-]*/g) || [])];
const escaped = expected.replace(/\./g, '\\.');
const versionPresent = new RegExp(`(^|[^0-9.])${escaped}([^0-9.]|$)`).test(contents);

console.log(`${binaryPath} (${fs.statSync(binaryPath).size} bytes)`);
console.log(`libcurl: ${libcurl.join(', ') || 'not found'}`);
console.log(`openssl ${expected}: ${versionPresent ? 'present' : 'MISSING'}`);

if (!versionPresent) {
  console.error(`expected the OpenSSL ${expected} version string to be embedded`);
  process.exit(1);
}
