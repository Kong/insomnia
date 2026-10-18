import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (request: Request) => Promise<Response>>(),
  netFetch: vi.fn(async (_input: unknown, _init?: unknown) => new Response('fetched', { status: 200 })),
}));

vi.mock('electron', () => ({
  app: { whenReady: vi.fn(async () => {}) },
  net: { fetch: electron.netFetch },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    isProtocolHandled: vi.fn(() => false),
    handle: vi.fn((scheme: string, handler: (request: Request) => Promise<Response>) => {
      electron.handlers.set(scheme, handler);
    }),
  },
  session: {},
}));
vi.mock('@getinsomnia/node-libcurl', () => ({ Curl: vi.fn(), CurlAuth: {}, CurlFeature: {}, CurlSslOpt: {} }));
vi.mock('insomnia-data', () => ({ services: {} }));
vi.mock('insomnia-data/common', () => ({ ProxyScopes: {} }));
vi.mock('./network/libcurl-promise', () => ({}));
vi.mock('./templating-worker-database', () => ({ resolveDbByKey: vi.fn() }));

import { registerInsomniaProtocols } from './api.protocol';

// The handler resolves its root as path.resolve(__dirname, 'client'). The real directory does not exist in the
// source tree, so we redirect only that exact call to a per-test tmp directory. Everything else runs for real.
const mainSrcDir = path.dirname(fileURLToPath(import.meta.url));
const originalResolve = path.resolve.bind(path);

let base: string;
let clientRoot: string;
let assetsDir: string;
let outsideDir: string;

const httpsHandler = () => {
  const handler = electron.handlers.get('https');
  if (!handler) {
    throw new Error('https protocol handler was not registered');
  }
  return handler;
};

const request = (requestPath: string) => httpsHandler()(new Request(`https://insomnia-app.local${requestPath}`));

const expectNotFound = async (requestPath: string) => {
  const response = await request(requestPath);
  expect(response.status).toBe(404);
  expect(electron.netFetch).not.toHaveBeenCalled();
};

const expectFetchedFile = async (requestPath: string, file: string) => {
  await request(requestPath);
  expect(electron.netFetch).toHaveBeenCalledTimes(1);
  expect(electron.netFetch).toHaveBeenCalledWith(pathToFileURL(file).href, { bypassCustomProtocolHandlers: true });
};

beforeAll(async () => {
  vi.spyOn(path, 'resolve').mockImplementation((...segments: string[]) => {
    if (segments[0] === mainSrcDir && segments[1] === 'client') {
      return clientRoot;
    }
    return originalResolve(...segments);
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await registerInsomniaProtocols();
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'api-protocol-handler-')));
  clientRoot = path.join(base, 'client');
  assetsDir = path.join(clientRoot, 'assets');
  outsideDir = path.join(base, 'outside');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  fs.writeFileSync(path.join(clientRoot, 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(assetsDir, 'app.js'), 'console.log(1);');
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'top secret');
  electron.netFetch.mockClear();
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('insomnia-app.local handler', () => {
  it('fetches a legitimate asset from rootDir/assets', async () => {
    await expectFetchedFile('/assets/app.js', path.join(assetsDir, 'app.js'));
  });

  it('returns 404 without fetching for an encoded-slash traversal', async () => {
    await expectNotFound('/assets/..%2f..%2foutside/secret.txt');
  });

  it('returns 404 without fetching for an encoded-backslash traversal', async () => {
    await expectNotFound('/assets/..%5c..%5coutside%5csecret.txt');
  });

  it('returns 404 without fetching for a NUL byte in the path', async () => {
    await expectNotFound('/assets/app.js%00.txt');
  });

  it('never serves outside rootDir for a raw backslash in the path', async () => {
    // The WHATWG URL parser rewrites raw backslashes to "/" for https and collapses the dot segments,
    // so this becomes /outside/secret.txt, a non-asset path that falls back to index.html.
    await expectFetchedFile('/assets/..\\..\\outside\\secret.txt', path.join(clientRoot, 'index.html'));
  });

  it('returns 404 without fetching for malformed percent-encoding', async () => {
    await expectNotFound('/assets/%E0%A4%A');
  });

  it('returns 404 without fetching when an in-tree symlink points outside rootDir', async () => {
    fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(assetsDir, 'leak.js'));
    await expectNotFound('/assets/leak.js');
  });

  it('returns 404 without fetching when a symlinked directory points outside rootDir', async () => {
    fs.symlinkSync(outsideDir, path.join(assetsDir, 'linkdir'));
    await expectNotFound('/assets/linkdir/secret.txt');
  });

  it('fetches an in-tree symlink whose target is also inside rootDir', async () => {
    const alias = path.join(assetsDir, 'alias.js');
    fs.symlinkSync(path.join(assetsDir, 'app.js'), alias);
    await expectFetchedFile('/assets/alias.js', alias);
  });

  it('falls through to fetch for a non-existent asset (realpath ENOENT is swallowed)', async () => {
    const missing = path.join(assetsDir, 'missing.js');
    await expectFetchedFile('/assets/missing.js', missing);
  });

  it('serves index.html for non-asset paths', async () => {
    await expectFetchedFile('/some/route', path.join(clientRoot, 'index.html'));
  });

  it('does not apply the asset containment logic to non-asset paths', async () => {
    // Traversal segments are normalised by the URL parser before reaching the handler, so this lands on /secret.
    await expectFetchedFile('/assets/../../outside/secret.txt', path.join(clientRoot, 'index.html'));
  });
});

describe('other origins', () => {
  it('passes other https hosts straight to net.fetch with the original request', async () => {
    const incoming = new Request('https://example.com/api?x=1');
    await httpsHandler()(incoming);
    expect(electron.netFetch).toHaveBeenCalledWith(incoming, { bypassCustomProtocolHandlers: true });
  });

  it('passes Google Fonts hosts straight to net.fetch by URL string', async () => {
    await httpsHandler()(new Request('https://fonts.googleapis.com/css?family=Inter'));
    expect(electron.netFetch).toHaveBeenCalledWith('https://fonts.googleapis.com/css?family=Inter', {
      bypassCustomProtocolHandlers: true,
    });
  });

  it('does not treat a lookalike host as the app origin', async () => {
    const incoming = new Request('https://insomnia-app.local.example.com/assets/app.js');
    await httpsHandler()(incoming);
    expect(electron.netFetch).toHaveBeenCalledWith(incoming, { bypassCustomProtocolHandlers: true });
  });
});
