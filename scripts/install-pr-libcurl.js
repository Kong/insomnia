// Replaces the @getinsomnia/node-libcurl native binary with the build produced
// by the OpenSSL 3.5.9 verification pre-release, so Insomnia runs the binary
// from the pull request instead of the published 3.3.0 one.
//
// Only Windows binaries are produced by that pre-release; other platforms keep
// the published binary (they do not link the vendored OpenSSL tree at all).
//
//   node scripts/install-pr-libcurl.js

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RELEASE = 'v3.3.1-ver.1';
const ELECTRON_ABI = 'electron-v43.2';
const EXPECTED_OPENSSL = '3.5.9';

const repoRoot = path.join(__dirname, '..');
const bindingPath = path.join(repoRoot, 'node_modules/@getinsomnia/node-libcurl/lib/binding/node_libcurl.node');

function hasVersion(contents, version) {
  const escaped = version.replace(/\./g, '\\.');
  return new RegExp(`(^|[^0-9.])${escaped}([^0-9.]|$)`).test(contents);
}

function assetUrl(arch) {
  const name = `node_libcurl-${RELEASE}-${ELECTRON_ABI}-win32-${arch}-unknown.tar.gz`;
  return `https://github.com/Kong/node-libcurl/releases/download/${RELEASE}/${name}`;
}

async function main() {
  if (process.platform !== 'win32') {
    console.log(`[pr-libcurl] ${process.platform} keeps the published binary, nothing to do`);
    return;
  }
  if (process.arch !== 'x64' && process.arch !== 'arm64') {
    console.log(`[pr-libcurl] unsupported architecture ${process.arch}, keeping the published binary`);
    return;
  }

  const url = assetUrl(process.arch);
  console.log(`[pr-libcurl] downloading ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[pr-libcurl] download failed: HTTP ${response.status} for ${url}`);
  }
  const archive = path.join(os.tmpdir(), path.basename(url));
  fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-libcurl-'));
  execFileSync('tar', ['-xzf', archive, '-C', extracted], { stdio: 'inherit' });

  const built = path.join(extracted, 'binding', 'node_libcurl.node');
  if (!fs.existsSync(built)) {
    throw new Error(`[pr-libcurl] archive does not contain binding/node_libcurl.node: ${archive}`);
  }

  const contents = fs.readFileSync(built).toString('latin1');
  if (!hasVersion(contents, EXPECTED_OPENSSL)) {
    throw new Error(`[pr-libcurl] downloaded binary does not link OpenSSL ${EXPECTED_OPENSSL}`);
  }

  fs.copyFileSync(built, bindingPath);
  console.log(`[pr-libcurl] installed ${fs.statSync(bindingPath).size} bytes into ${bindingPath}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exitCode = 1;
});
