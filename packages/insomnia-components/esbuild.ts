import { build } from 'esbuild';

build({
  entryPoints: ['./src/index.ts'],
  format: 'esm',
  outfile: './dist/index.js',
  bundle: true,
  external: ['react', 'react-dom', 'styled-components'],
});
