import { build } from 'esbuild';
import path from 'path';

import packageJSON from './package.json';

const _DEV_ = process.env.NODE_ENV === 'development';
const PORT = packageJSON.dev['dev-server-port'];
const outdir = _DEV_
  ? path.join(__dirname, 'app')
  : path.join(__dirname, 'build');

const env: Record<string, string> = _DEV_
  ? {
    'process.env.APP_RENDER_URL': JSON.stringify(
      `http://localhost:${PORT}/index.html`
    ),
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.INSOMNIA_ENV': JSON.stringify('development'),
    'process.env.RELEASE_DATE': JSON.stringify(new Date()),
  }
  : {
    __DEV__: 'false',
    'process.env.NODE_ENV': JSON.stringify('production'),
  };

build({
  entryPoints: ['./app/main.development.ts'],
  outfile: path.join(outdir, 'main.min.js'),
  bundle: true,
  platform: 'node',
  sourcemap: true,
  format: 'cjs',
  define: env,
  external: [
    '@getinsomnia/node-libcurl',
    'electron',
  ],
});
