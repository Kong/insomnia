import { readFileSync } from "fs";
import { builtinModules } from "module";
import path from "path";
import * as vite from "vite";
import react from "@vitejs/plugin-react";

import commonjsExt from "vite-plugin-commonjs-externals";

const pkg = JSON.parse(readFileSync("./package.json").toString("utf-8"));

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
  "nunjucks/browser/nunjucks",
  "insomnia-xpath",
  "insomnia-prettify",
  "insomnia-url",
  "styled-components",
  "node-libcurl",
  "@getinsomnia/node-libcurl",
  "insomnia-plugin-kong-portal",
  "nimma",
  "path",
  "system",
  "file",
  "url",
  ...Object.keys(pkg.dependencies).filter(
    (name) => !pkg.packedDependencies.includes(name)
  ),
  "network/ca-certs.js",
  ...builtinModules
];

export default vite.defineConfig({
  mode: "development",
  root: path.join(__dirname, "app"),
  base: "/",
  resolve: {
    alias: {
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom", "react-dom/server"],
  },
  define: {
    __DEV__: true,
    "process.env.NODE_ENV": JSON.stringify("development"),
    "process.env.INSOMNIA_ENV": JSON.stringify("development")
  },
  server: {
    port: pkg.dev["dev-server-port"],
    fs: {
      strict: true
    }
  },
  optimizeDeps: {
    exclude: commonjsPackages
  },
  build: {
    sourcemap: true,
    outDir: "dist",
    assetsDir: ".",
    terserOptions: {
      ecma: 2020,
      compress: {
        passes: 2
      },
      safari10: false
    },
    emptyOutDir: true,
    brotliSize: false
  },
  plugins: [
    commonjsExt({ externals: commonjsPackages }),
    react({
      fastRefresh: true,
      jsxRuntime: "classic",
      babel: {
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-proposal-class-properties", { loose: true }]
        ]
      }
    })
  ]
});
