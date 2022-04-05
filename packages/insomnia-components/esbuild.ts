import { build } from 'esbuild';

async function main() {
  await build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    external: ['react', 'react-dom', 'styled-components'],
    format: 'esm',
    outfile: './dist/index.js',
    watch: Boolean(process.env.ESBUILD_WATCH),
  });

  process.exit(0);
}

main();
