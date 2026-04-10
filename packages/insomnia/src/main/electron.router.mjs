/* eslint-env node */

import * as fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import * as mime from 'mime-types';
import { createRequestHandler } from 'react-router';

const { fetch, Response } = globalThis;

// Logic for dev/prod DX was adopted from https://github.com/jacob-ebey/remix-electron-llamafile/blob/main/electron/index.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const packageRoot = path.resolve(appRoot, '..');

const DEVELOPMENT = process.env.NODE_ENV !== 'production';

const viteDevServer = DEVELOPMENT
  ? await import('vite').then(vite =>
      vite.createServer({
        configFile: path.resolve(packageRoot, 'vite.config.ts'),
        root: packageRoot,
        server: {
          port: 5173,
          strictPort: true,
          hmr: {
            host: 'localhost',
            port: 8888,
            clientPort: 8888,
            protocol: 'ws',
          },
        },
      }),
    )
  : undefined;

const build = async () => {
  if (viteDevServer) {
    return viteDevServer.ssrLoadModule('virtual:react-router/server-build');
  }

  return import('./build/server/index.js');
};

let port = '';
if (viteDevServer) {
  await viteDevServer.listen(5173);
  const address = viteDevServer.httpServer?.address();

  if (address && typeof address !== 'string') {
    port = `:${address.port}`;
  } else if (address) {
    const url = new URL(address);
    port = `:${url.port}`;
  } else {
    throw new Error('Failed to get dev server port');
  }
}

function createAppRequestHandler() {
  const requestHandler = createRequestHandler(build);

  return async request => {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };

    const logBuffer = [];

    console.log = (...args) => logBuffer.push({ type: 'log', args });
    console.error = (...args) => logBuffer.push({ type: 'error', args });
    console.warn = (...args) => logBuffer.push({ type: 'warn', args });
    console.info = (...args) => logBuffer.push({ type: 'info', args });
    console.debug = (...args) => logBuffer.push({ type: 'debug', args });

    const restoreConsole = () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
    };

    const flushLogs = () => {
      logBuffer.forEach(({ type, args }) => {
        originalConsole[type](...args);
      });
    };

    try {
      const url = new URL(request.url);
      const response = await requestHandler(request);

      if (response.status === 404 && url.pathname !== '/' && (request.method === 'GET' || request.method === 'HEAD')) {
        if (viteDevServer) {
          const staticFile = path.resolve(appRoot, 'static' + url.pathname);

          if (
            await fsp
              .stat(staticFile)
              .then(stat => stat.isFile())
              .catch(() => false)
          ) {
            return new Response(await fsp.readFile(staticFile), {
              headers: {
                'content-type': mime.lookup(path.basename(staticFile)) || 'text/plain',
              },
            });
          }

          try {
            const vitePort = viteDevServer.config.server.port || 5173;
            const viteHost = viteDevServer.config.server.host || 'localhost';
            const viteUrl = `http://${viteHost}:${vitePort}${url.pathname}${url.search}`;
            const viteResponse = await fetch(viteUrl);

            if (viteResponse.ok) {
              const headers = {};
              viteResponse.headers.forEach((value, key) => {
                headers[key] = value;
              });

              return new Response(await viteResponse.arrayBuffer(), {
                status: viteResponse.status,
                headers,
              });
            }
          } catch (proxyError) {
            console.error('Proxy error:', proxyError);
          }

          if (request.method === 'HEAD') {
            return new Response(null, {
              headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, HEAD',
              },
            });
          }

          try {
            const transformed = await viteDevServer.transformRequest(url.pathname + url.search);

            if (transformed) {
              return new Response(transformed.code, {
                headers: {
                  'content-type': 'application/javascript',
                },
              });
            }
          } catch {}
        } else {
          try {
            const assetDir = path.resolve(__dirname, path.join('build', 'client'));
            const requestedPath = path.normalize(url.pathname).replace(/^((\.\.)[/\\])+/, '');

            const pathToServe = path.resolve(assetDir, requestedPath.slice(1));
            const relativePath = path.relative(assetDir, pathToServe);
            const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);

            if (!isSafe) {
              throw new Error('Invalid file path');
            }

            const isFile = await fsp.stat(pathToServe).then(stat => stat.isFile());
            if (isFile) {
              return new Response(await fsp.readFile(pathToServe), {
                headers: {
                  'content-type': mime.lookup(path.basename(pathToServe)) || 'text/plain',
                },
              });
            }
          } catch (error) {
            console.error('Error serving static file:', error);
          }
        }
      }

      restoreConsole();
      flushLogs();
      return response;
    } catch (error) {
      restoreConsole();
      flushLogs();
      console.error('ROUTING ERROR', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

export function initElectronRouter() {
  return {
    createAppRequestHandler,
    url: `https://localhost${port}/`,
  };
}
