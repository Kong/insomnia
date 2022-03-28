import { build } from 'esbuild';

build({
  bundle: true,
  entryPoints: ['./src/index.ts'],
  external: ['react', 'react-dom', 'styled-components'],
  format: 'esm',
  outfile: './dist/index.js',
  watch: Boolean(process.env.ESBUILD_WATCH),
});
