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
  plugins: [
    // taken from https://github.com/tjx666/awesome-vscode-extension-boilerplate/blob/main/scripts/esbuild.ts
    {
      name: 'umd2esm',
      setup(build) {
        build.onResolve({ filter: /^(vscode-.*|estree-walker|jsonc-parser)/ }, args => {
          const pathUmdMay = require.resolve(args.path, {
            paths: [args.resolveDir],
          });
          // Call twice the replace is to solve the problem of the path in Windows
          const pathEsm = pathUmdMay
            .replace('/umd/', '/esm/')
            .replace('\\umd\\', '\\esm\\');
          return { path: pathEsm };
        });
      },
    },
  ],
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
