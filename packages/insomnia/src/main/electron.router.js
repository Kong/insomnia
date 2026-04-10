import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as mime from 'mime-types';
import { createRequestHandler } from 'react-router';

// Logic for dev/prod DX was adopted from https://github.com/jacob-ebey/remix-electron-llamafile/blob/main/electron/index.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEVELOPMENT = process.env.NODE_ENV !== 'production';

const viteDevServer = DEVELOPMENT
  ? await import('vite').then(vite =>
      vite.createServer({
        server: {
          // middlewareMode: true,
          strictPort: true,
          hmr: {
            host: 'localhost',
            port: 8888,
            clientPort: 8888,
            protocol: 'ws',
          },
        },
        resolve: {
          alias: {
            '~': path.resolve(__dirname, 'app'),
          },
        },
        publicDir: path.resolve(__dirname, 'public'),
      }),
    )
  : undefined;

const build = async () => {
  if (viteDevServer) {
    return viteDevServer.ssrLoadModule('virtual:react-router/server-build'); // as Promise<ServerBuild>;
  }
  // @ts-ignore @TODO Make sure this is using the correct build path in production
  return import('./build/server/index.js'); // as Promise<ServerBuild>
};

let port = '';
if (viteDevServer) {
  await viteDevServer.listen(5173);
  const address = viteDevServer.httpServer?.address();
  if (address && typeof address !== 'string') {
    port = ':' + address.port;
  } else if (address) {
    const url = new URL(address);
    port = ':' + url.port;
  } else {
    throw new Error('Failed to get dev server port');
  }
}

function createAppRequestHandler() {
  let requestHandler = createRequestHandler(build);

  return async request => {
    //: Request) => {
    // Buffer console logs during request handling
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };

    const logBuffer = [];

    // Override console methods to buffer logs
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

      if (
        response.status === 404 && // Try to handle the request as a static file
        url.pathname !== '/' &&
        (request.method === 'GET' || request.method === 'HEAD')
      ) {
        if (viteDevServer) {
          // First, try to serve from public directory
          const staticFile = path.resolve(__dirname, 'public' + url.pathname);

          if (
            await fsp
              .stat(staticFile)
              .then(s => s.isFile())
              .catch(() => false)
          ) {
            return new Response(await fsp.readFile(staticFile), {
              headers: {
                'content-type': mime.lookup(path.basename(staticFile)) || 'text/plain',
              },
            });
          }

          // For other requests, proxy to Vite's dev server
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

          // Fallback to transform request for imports
          if (request.method === 'HEAD') {
            return new Response(null, {
              headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, HEAD',
              },
            });
          }

          try {
            // Simply let Vite handle ALL requests normally
            // Don't try to intercept asset requests - let Vite's dev server handle them
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
            const requestedPath = path
              .normalize(url.pathname)
              // Remove leading ../
              .replace(/^(\.\.[/\\])+/, '');

            // Adopted from https://www.electronjs.org/docs/latest/api/protocol#protocolhandlescheme-handler
            const pathToServe = path.resolve(assetDir, requestedPath.slice(1));
            const relativePath = path.relative(assetDir, pathToServe);
            const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);

            if (!isSafe) {
              throw new Error('Invalid file path');
            }

            const isFile = await fsp.stat(pathToServe).then(s => s.isFile());
            if (isFile) {
              return new Response(await fsp.readFile(pathToServe), {
                headers: {
                  'content-type': mime.lookup(path.basename(pathToServe)) || 'text/plain',
                },
              });
            }
          } catch (e) {
            console.error('Error serving static file:', e);
          }
        }
      }

      // If the request is not a static file, handle it with the React Router
      // Restore console and flush buffered logs only when returning the response
      restoreConsole();
      flushLogs();
      return response;
    } catch (error) {
      // Restore console in case of error but don't flush logs
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
