import { build } from "esbuild";
import path from "path";
const alias = require('esbuild-plugin-alias');

const _DEV_ = process.env.NODE_ENV === "development";

const env = _DEV_
  ? {
    "process.env.APP_RENDER_URL": JSON.stringify(
      `http://localhost:3334/index.html`
    ),
    "process.env.NODE_ENV": JSON.stringify("development"),
    "process.env.INSOMNIA_ENV": JSON.stringify("development"),
    "process.env.RELEASE_DATE": JSON.stringify(new Date()),
    window: JSON.stringify({
      localStorage: {
        getItem: () => undefined,
        setItem: () => { },
      },
      performance: { now: () => 0 },
      requestAnimationFrame: () => { },
      cancelAnimationFrame: () => { },
    }),
  }
  : {
    __DEV__: "false",
    "process.env.NODE_ENV": JSON.stringify("production"),
    window: JSON.stringify({
      localStorage: {
        getItem: () => undefined,
        setItem: () => { },
      },
      performance: { now: () => 0 },
      requestAnimationFrame: () => { },
      cancelAnimationFrame: () => { },
    }),
  };

async function main() {
  await build({
    entryPoints: ["./send-request/index.ts"],
    outfile: '../insomnia-send-request/dist/index.js',
    bundle: true,
    platform: "node",
    target: "esnext",
    sourcemap: true,
    format: "cjs",
    define: env,
    tsconfig: 'tsconfig.build.sr.json',
    plugins: [
      alias({
        'electron': path.resolve(__dirname, './send-request/electron/index.js'),
      }),
    ],
    external: ["@getinsomnia/node-libcurl"]
  });

  process.exit(0);
}

main();
