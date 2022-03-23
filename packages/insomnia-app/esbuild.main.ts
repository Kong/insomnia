import { build } from "esbuild";
import path from "path";
import { builtinModules } from "module";
import packageJSON from "./package.json";

const commonjsPackages = [
  "electron",
  "electron/main",
  "electron/common",
  "electron/renderer",
  "original-fs",
  "crypto",
  "fs",
  "@grpc/grpc-js",
  "insomnia-url",
  "insomnia-config",
  "insomnia-common",
  "insomnia-cookies",
  "insomnia-importers",
  "insomnia-components",
  "insomnia-xpath",
  "insomnia-prettify",
  "insomnia-url",
  "styled-components",
  "node-libcurl",
  "insomnia-plugin-kong-portal",
  "nimma",
  "path",
  "system",
  "file",
  "url",
  ...Object.keys(packageJSON.dependencies).filter(
    (name) => !packageJSON.packedDependencies.includes(name)
  ),
  "network/ca-certs.js",
  ...builtinModules
];

const _DEV_ = process.env.NODE_ENV === "development";
const PORT = packageJSON.dev["dev-server-port"];
const outdir = _DEV_
  ? path.join(__dirname, "app")
  : path.join(__dirname, "build");

const env = _DEV_
  ? {
      "process.env.APP_RENDER_URL": JSON.stringify(
        `http://localhost:${PORT}/index.html`
      ),
      "process.env.NODE_ENV": JSON.stringify("development"),
      "process.env.INSOMNIA_ENV": JSON.stringify("development"),
      "process.env.RELEASE_DATE": JSON.stringify(new Date())
    }
  : {
      __DEV__: "false",
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.HOT": JSON.stringify(null)
    };

async function main() {
  await build({
    entryPoints: ["./app/main.development.ts"],
    outfile: path.join(outdir, "main.min.js"),
    // minify: !_DEV_,
    bundle: true,
    platform: "node",
    target: "esnext",
    sourcemap: true,
    watch: true,
    format: "cjs",
    define: env,
    external: [
      ...Object.keys(packageJSON.dependencies).filter(
        (name) => !packageJSON.packedDependencies.includes(name)
      ),
      "file",
      "system",
      "electron"
    ]
    // external: commonjsPackages,
    // plugins: [
    //   '@babel/plugin-proposal-class-properties',
    //   '@babel/plugin-proposal-object-rest-spread',
    //   '@babel/plugin-proposal-optional-chaining',
    // ]
  });

  process.exit(0);
}

main();
