import { build } from 'esbuild';
import path from 'path';

const outdir = path.join(__dirname, 'build');

build({
  entryPoints: ['./app/preload.ts'],
  outfile: path.join(outdir, 'preload.js'),
  bundle: true,
  platform: 'node',
  sourcemap: true,
  format: 'esm',
  external: ['@getinsomnia/node-libcurl', 'electron'],
});
