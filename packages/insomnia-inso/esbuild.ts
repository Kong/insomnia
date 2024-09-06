import { build, type BuildOptions, context } from 'esbuild';

const isProd = Boolean(process.env.NODE_ENV === 'production');
const watch = Boolean(process.env.ESBUILD_WATCH);
const version = process.env.VERSION || 'dev';
const config: BuildOptions = {
  outfile: './dist/index.js',
  bundle: true,
  platform: 'node',
  minify: isProd,
  target: 'node20',
  sourcemap: true,
  format: 'cjs',
  tsconfig: 'tsconfig.json',
  define: {
    'process.env.DEFAULT_APP_NAME': JSON.stringify(isProd ? 'Insomnia' : 'insomnia-app'),
    'process.env.VERSION': JSON.stringify(isProd ? version : 'dev'),
    '__DEV__': JSON.stringify(!isProd),
  },
  external: ['@getinsomnia/node-libcurl', 'fsevents', 'mocha'],
  entryPoints: ['./src/index.ts'],
};

if (watch) {
  async function watch() {
    const ctx = await context(config);
    await ctx.watch();
  }
  watch();
} else {
  build(config);
}
