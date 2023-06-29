import { build } from 'esbuild';
import alias from 'esbuild-plugin-alias';
import path from 'path';

async function main() {
  await build({
    entryPoints: ['./send-request/index.ts'],
    outfile: '../insomnia-send-request/dist/index.js',
    bundle: true,
    platform: 'node',
    target: 'node16',
    sourcemap: true,
    format: 'cjs',
    tsconfig: 'tsconfig.build.sr.json',
    plugins: [
      alias({
        'electron': path.resolve(__dirname, './send-request/electron/index.js'),
      }),
    ],
    external: ['@getinsomnia/node-libcurl'],
  });

  process.exit(0);
}

main();
