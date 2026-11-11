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
const openssl = [...new Set(contents.match(/OpenSSL \d+\.\d+\.\d+[a-z]*/g) || [])];
const libcurl = [...new Set(contents.match(/libcurl\/\d+\.\d+\.\d+[A-Z-]*/g) || [])];

console.log(`${binaryPath} (${fs.statSync(binaryPath).size} bytes)`);
console.log(`openssl: ${openssl.join(', ') || 'not found'}`);
console.log(`libcurl: ${libcurl.join(', ') || 'not found'}`);

if (!openssl.some(entry => entry.includes(`OpenSSL ${expected}`))) {
  console.error(`expected OpenSSL ${expected} to be linked in`);
  process.exit(1);
}
