import esbuild from 'esbuild';
import { builtinModules } from 'module';
import path from 'path';

import pkg from './package.json';

interface Options {
  mode?: 'development' | 'production';
}

export default async function build(options: Options) {
  const mode = options.mode || 'production';
  const __DEV__ = mode !== 'production';
  const PORT = pkg.dev['dev-server-port'];

  const outdir = __DEV__
    ? path.join(__dirname, 'src')
    : path.join(__dirname, 'build');

  const env: Record<string, string> = __DEV__
    ? {
      'process.env.APP_RENDER_URL': JSON.stringify(
        `http://localhost:${PORT}/index.html`
      ),
      'process.env.HIDDEN_BROWSER_WINDOW_URL': JSON.stringify(
        `http://localhost:${PORT}/renderers/hidden-browser-window/index.html`
      ),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
      'process.env.BUILD_DATE': JSON.stringify(new Date()),
    }
    : {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.INSOMNIA_ENV': JSON.stringify('production'),
      'process.env.BUILD_DATE': JSON.stringify(new Date()),
    };
  const preload = esbuild.build({
    entryPoints: ['./src/preload.ts'],
    outfile: path.join(outdir, 'preload.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
  });
  const preloadHiddenBrowserWindow = esbuild.build({
    entryPoints: ['./src/renderers/hidden-browser-window/preload.ts'],
    outfile: path.join(outdir, 'renderers/hidden-browser-window/preload-hidden-browser-window.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
  });
  const hiddenBrowserWindow = esbuild.build({
    entryPoints: ['./src/renderers/hidden-browser-window/index.ts'],
    // the hidden browser window script is always outputed to 'src' as index.html requires a built bundle
    outfile: path.join(__dirname, 'src', 'renderers/hidden-browser-window/index.js'),
    target: 'esnext',
    bundle: true,
    platform: 'browser',
    sourcemap: true,
    format: 'cjs',
    external: [],
  });
  const main = esbuild.build({
    entryPoints: ['./src/main.development.ts'],
    outfile: path.join(outdir, 'main.min.js'),
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    define: env,
    external: [
      'electron',
      '@getinsomnia/node-libcurl',
      ...Object.keys(pkg.dependencies),
      ...Object.keys(builtinModules),
    ],
  });

  return Promise.all([main, preload, preloadHiddenBrowserWindow, hiddenBrowserWindow]);
}

// Build if ran as a cli script
const isMain = require.main === module;

if (isMain) {
  const mode =
    process.env.NODE_ENV === 'development' ? 'development' : 'production';
  build({ mode });
}
