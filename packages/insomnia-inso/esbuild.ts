import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

const isProd = Boolean(process.env.NODE_ENV === 'production');
const watch = Boolean(process.env.ESBUILD_WATCH);
const version = process.env.VERSION || 'dev';

build({
  outfile: './dist/index.js',
  bundle: true,
  platform: 'node',
  minify: isProd,
  target: 'node18',
  sourcemap: true,
  format: 'cjs',
  tsconfig: 'tsconfig.json',
  watch,
  plugins: [
    // Exclude node_modules from the bundle since they will be packaged with the cli
    nodeExternalsPlugin(),
  ],
  define: {
    'process.env.DEFAULT_APP_NAME': JSON.stringify(isProd ? 'Insomnia' : 'insomnia-app'),
    'process.env.VERSION': JSON.stringify(isProd ? version : 'dev'),
    '__DEV__': JSON.stringify(!isProd),
  },
  external: ['@getinsomnia/node-libcurl', 'mocha'],
  entryPoints: ['./src/index.ts'],
});
