import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, net: {}, protocol: {}, session: {} }));
vi.mock('@getinsomnia/node-libcurl', () => ({ Curl: vi.fn(), CurlAuth: {}, CurlFeature: {}, CurlSslOpt: {} }));
vi.mock('insomnia-data', () => ({ services: {} }));
vi.mock('insomnia-data/common', () => ({ ProxyScopes: {} }));
vi.mock('./network/libcurl-promise', () => ({}));
vi.mock('./templating-worker-database', () => ({}));

import { resolveClientFilePath } from './api.protocol';

const rootDir = path.resolve('/app/resources/client');

// Mirrors what the real handler does with request.url, then what a file:// fetch does (decoding the file URL)
const effectiveFile = (requestPath: string) => {
  const url = new URL(`https://insomnia-app.local${requestPath}`);
  const resolved = resolveClientFilePath(rootDir, url.pathname);
  return resolved === null ? null : fileURLToPath(pathToFileURL(resolved).href);
};

const isInside = (file: string) => {
  const rel = path.relative(rootDir, file);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
};

describe('resolveClientFilePath', () => {
  it.each([
    '/assets/../../x',
    '/assets/..%2f..%2fx',
    '/assets/..%2F..%2Fx',
    '/assets/%2e%2e/%2e%2e/x',
    '/assets/%2e%2e%2f%2e%2e%2fx',
    '/assets/%252e%252e%252f%252e%252e%252fx',
    '/assets/..%5c..%5cx',
    '/assets/..\\..\\x',
    '/assets%2f..%2f..%2fx',
    '/assets/x%00.js',
    '/assets/%00',
    '/assets//etc/passwd',
    '/assets/%2fetc%2fpasswd',
    '/assets/..',
    '/assets/%E0%A4%A',
  ])('never resolves outside rootDir for %s', requestPath => {
    const file = effectiveFile(requestPath);
    if (file !== null) {
      expect(isInside(file)).toBe(true);
    }
  });

  it('rejects encoded traversal', () => {
    expect(effectiveFile('/assets/..%2f..%2fx')).toBeNull();
    expect(effectiveFile('/assets/..%5c..%5cx')).toBeNull();
    expect(effectiveFile('/assets/x%00.js')).toBeNull();
      });

  it('serves legitimate assets, including encoded characters', () => {
    expect(resolveClientFilePath(rootDir, '/assets/index-abc123.js')).toBe(path.join(rootDir, 'assets', 'index-abc123.js'));
    expect(resolveClientFilePath(rootDir, '/assets/sub/font%20name.woff2')).toBe(
      path.join(rootDir, 'assets', 'sub', 'font name.woff2'),
    );
  });

  it('serves index.html for non-asset paths', () => {
    expect(resolveClientFilePath(rootDir, '/some/route')).toBe(path.join(rootDir, 'index.html'));
    expect(resolveClientFilePath(rootDir, '/')).toBe(path.join(rootDir, 'index.html'));
  });
});
