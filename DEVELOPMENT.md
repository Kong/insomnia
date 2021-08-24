# Development Overview

The purpose of this document is to provide a general overview of the application architecture.

## Technologies

Insomnia is a desktop application built on top of [Electron](http://electronjs.org/). Electron
provides a Chromium runtime for the Insomnia web app to run inside of, as well as additional tools
to provide access to operating system features.

There are a few more technologies and tools worth mentioning:

- [`React`](https://reactjs.org/) is the library used for all UI components.
- [`styled-components`](https://styled-components.com/) and [`Less`](http://lesscss.org/) are used
  for styling UI components.
- [`Electron Builder`](https://github.com/electron-userland/electron-builder) is used to help build,
  sign, and package Insomnia for distribution.
- [`Flow`](https://flow.org/) is used for adding types to the codebase. Not everything is Flow but
  all new code should be typed with Flow.
- [`Webpack`](https://webpack.js.org/) is the bundler used to compile the JS/Less/babel/etc
- [`libcurl`](https://curl.se/libcurl/) is the library that Insomnia uses to make requests. Libcurl is the HTTP client of choice because it allows the deepest amount of debuggability and control of HTTP requests.
- [`nedb`](https://github.com/louischatriot/nedb) a local in-memory database.
- [`node-libcurl`](https://github.com/JCMais/node-libcurl) is a Node.js wrapper around the native libcurl library.
- [`Codemirror`](https://codemirror.net/) is a web-based, extendable, code editor used for
  highlighting and linting of data formats like JSON, GraphQL, and XML.
- [`Commander.js`](https://github.com/tj/commander.js) is used for building the inso CLI.

## Project Structure

Insomnia uses [`lerna`](https://lerna.js.org/) to manage multiple npm packages within a single
repository. There are currently two package locations:

- `/packages` contains related packages that are consumed by `insomnia-app` or externally.
- `/plugins` contains plugin packages that are included by default with the application.

## The `insomnia-app` Main Package

`/packages/insomnia-app` is the entry point for the app. All other packages are imported from this
one.

There are a few notable directories inside of it:

- `/main.development.js` Entry for Electron.
- `/app/main` Stuff that runs inside Electron's main process.
- `/app/ui` React components and styling.
- `/app/common` Utilities used across both main and render processes.
- `/app/plugins` Logic around installation and usage of plugins.
- `/app/models` DB models used to store user data.
- `/app/network` Sending requests and performing auth (eg. OAuth 2).
- `/app/templating` Nunjucks and rendering related code.
- `/app/sync(-legacy)?` and `/app/accounts` Team sync and account stuff.

## Data and State Architecture

Insomnia stores data in a few places:

- A local in-memory NeDB database stores data for data models (requests, folder, workspaces, etc).
- A local Redux store contains an in-memory copy of all database entities.
- Multiple React Context stores, defined in `/app/ui/context`.

*Eventually, Redux could/should be removed, which would both reduce memory overhead and simplify
the codebase. NeDB should essentially replace it*

## Automated testing

We use [Jest](https://jestjs.io/) and [react-testing-library](https://testing-library.com/docs/react-testing-library)
to write our unit tests, and [Spectron](https://www.electronjs.org/spectron) for integration tests.

Unit tests exist alongside the file under test. For example:
- `/app/common/database.js` contains the database business logic
- `/app/common/__tests__/database.test.js` contains the database tests

Unit tests for components follow the same pattern.

The structure for smoke tests is explained in the smoke testing package: [`packages/insomnia-smoke-test`](/packages/insomnia-smoke-test).

## Technical Debt

This is just a brief summary of Insomnia's current technical debt.

- Loading large responses (~20MB) can crash the app on weaker hardware.
- An in-memory duplicate of the local DB is stored in Redux, unnecessarily doubling memory usage. Moving
  forward, Redux shouldn't need to be considered much and may be able to be removed eventually.
- Bundling `libcurl` (native module) has caused many weeks of headaches trying to get builds working
  across Windows, Mac, and Linux. More expertise here is definitely needed.
- All input fields that support templating/autocomplete/etc are actually Codemirror instances. This
  isn't really debt but may affect things going forward.
- Use of `libcurl` means Insomnia can't run in a web browser and can't support bidirectional socket
  communication.
