import { build } from 'esbuild';

build({
  bundle: true,
  entryPoints: ['./src/index.ts'],
  external: ['react', 'react-dom', 'styled-components'],
  format: 'cjs',
  outfile: './dist/index.js',
  watch: Boolean(process.env.ESBUILD_WATCH),
});
