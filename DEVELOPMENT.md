# Development Overview

The purpose of this document is to provide a general overview of the application architecture.

## Technologies

Insomnia is a desktop application built on top of [Electron](http://electronjs.org/). Electron provides a Chromium runtime for the Insomnia web app to run inside, as well as additional tools to provide access to operating system features.

There are a few more technologies and tools worth mentioning:

- [`React`](https://reactjs.org/) is the library used for all UI components.
- [`tailwind`](https://tailwindcss.com/) is used for styling UI components.
- [`Electron Builder`](https://github.com/electron-userland/electron-builder) is used to help build, sign, and package Insomnia for distribution.
- [`libcurl`](https://curl.se/libcurl/) is the library that Insomnia uses to make requests. We used libcurl as our HTTP client of choice because it allows the deepest amount of debuggability and control of HTTP requests.
- [`NeDB`](https://github.com/louischatriot/nedb) a local in-memory database.
- [`node-libcurl`](https://github.com/JCMais/node-libcurl) is a Node.js wrapper around the native libcurl library.
- [`CodeMirror`](https://codemirror.net/) is a web-based, extendable, code editor used for highlighting and linting of data formats like JSON, GraphQL, and XML.
- [`Commander.js`](https://github.com/tj/commander.js) is used for building the Inso CLI.

## Project Structure

Insomnia uses [`npm workspaces`](https://docs.npmjs.com/cli/v9/using-npm/workspaces?v=true) to manage multiple npm packages within a single repository. There are currently the following package locations:

- `/packages` contains related packages that are consumed by `insomnia` or externally.

Insomnia Inso CLI is built using a series of steps

1. `insomnia-inso` uses monorepo references to import `insomnia` and `insomnia-testing` to expose  `getSendRequestCallbackMemDb` and `generate`, `runTests`, `runTestsCli` respectively
1. `packages/insomnia-inso/dist/index.js` is transpiled with esbuild to commonjs
1. `packages/insomnia-inso/bin/inso` is shell script which points at `packages/insomnia-inso/dist/index.js` and is used for local development
1. `packages/insomnia-inso/binaries/inso` is an executable made with `pkg`

`getSendRequestCallbackMemDb` exposes some behaviour from the insomnia renderer.

- database: to fetch needed models
- nunjucks templates: to interpolate the fields containing tags
- node-libcurl: to send the request
- fs: to persist responses
- plugins: potentially needed by the community, unclear if the implementation works

Problems

- inso bundles almost the entire renderer, react components included, meaning that although we are intending to use this code in node we are bundling it using rules intended for browsers and stubs electron.
- node-libcurl present bundling issues because it needs to re-download a different version from npm each time you want to work on either insomnia or inso.
- nunjucks codepaths haven't been touched in a long time, they need some love in order to be able to understand how to make them composable.

Unexplored ideas in this area.

- create a database package with nunjucks templating and have both insomnia and inso use it with project references, use node-libcurl directly, that way we don't need to stub electorn and only import the code we use.
- use an adapter pattern in inso to replace node-libcurl with fetch in order to avoid the bundling issues NaN modules present.
- remove plugin support from inso and reimplement later with a fixed and supported API.

## The `insomnia` Main Package

`/packages/insomnia` is the entry point for the app. All other packages are imported from this one.

There are a few notable directories inside it:

- `/main.development.js` Entry for Electron.
- `/src/main` Stuff that runs inside Electron's main process.
- `/src/ui` React components and styling.
- `/src/common` Utilities used across both main and render processes.
- `/src/plugins` Logic around installation and usage of plugins.
- `/src/models` DB models used to store user data.
- `/src/network` Sending requests and performing auth (e.g. OAuth 2).
- `/src/templating` Nunjucks and rendering related code.
- `/src/sync` and `/src/account` Team sync and account stuff.

## Data and State Architecture

Insomnia stores data in a few places:

- A local in-memory NeDB database stores data for data models (requests, folder, workspaces, etc.).
- localstorage
- a fake localstorage api that writes to file and is used for window sizing

> Note: NeDB is officially unmaintained (even for critical security bugs) and was last published in February 2016. Due to this, we hope to move away from it, however doing so is tricky because of how deeply tied it is to our architecture.

## Automated testing

We use [Vitest](https://vitest.dev/) and [Playwright](https://github.com/microsoft/playwright)

Unit tests exist alongside the file under test. For example:

- `/src/common/database.js` contains the database business logic
- `/src/common/__tests__/database.test.js` contains the database tests

Unit tests for components follow the same pattern.

The structure for smoke tests is explained in the smoke testing package: [`packages/insomnia-smoke-test`](packages/insomnia-smoke-test).

## Technical Debt

This is just a brief summary of Insomnia's current technical debt.

- Loading large responses (~20 MB) can crash the app on weaker hardware.
- Bundling `libcurl` (native module) has caused many weeks of headaches trying to get builds working across Windows, Mac, and Linux. More expertise here is definitely needed.
- All input fields that support features like templating or code completion are actually [CodeMirror](https://codemirror.net/6/) instances. This isn't really debt, but may affect things going forward.

- [x] upgrade spectral e2e testing
- [x] upgrading electron
- [x] preload electron main functions
- [x] update react classes to function components
- [x] remove excess packages
- [x] migrate redux to remix
- [x] migrate lerna to npm workspaces
- [x] CI slow ~30m (now 10m)
- [x] styling vision (react-aria + tailwind)
- [ ] de-polymorph database
- [ ] codemirror is unmaintained
- [x] nedb is unmaintained
- [ ] grpc state state should be in main rather than renderer
- [x] drag and drop is flakey
- [ ] sync code is spaghetti
- [ ] template rendering is spaghetti and has poor discoverability
- [ ] inso abstraction limits networking improvements
- [ ] testing feature doesn't scale with investment
- [ ] unify curl.ts and libcurl-promise implementations
- [x] send-request

## Electron upgrade

<https://releases.electronjs.org/>

bump the following node and electron versions

- `.npmrc`
- `.nvmrc`
- `packages/insomnia/package.json` electron and node-libcurl
- `shell.nix`
