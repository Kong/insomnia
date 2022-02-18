# Insomnia Smoke Tests

This project contains the smoke testing suite for Insomnia and Inso.

Tests for the Electron app are written using [Playwright](https://github.com/microsoft/playwright)  while tests for the CLI use [execa](https://github.com/sindresorhus/execa).

## Structure

| Folder       | Purpose                           |
| ------------ | --------------------------------- |
| `/cli`       | tests for inso                    |
| `/tests`     | tests for Insomnia                |
| `/playwright`| test helpers                      |
| `/server`    | Express server used by the tests  |
| `/fixtures`  | data used by tests and the server |

## Run Insomnia app smoke tests

### Development method

In one terminal run the watcher

```shell
npm run watch:app   # Run watcher
```

In a second terminal run/debug/step through smoke tests

```shell
# Run tests
npm run test:smoke:dev
# Debug tests with playwright logs
DEBUG=pw:api npm run test:smoke:dev
# Debug tests with insomnia console logs
DEBUG=pw:browser npm run test:smoke:dev
# Step through tests with playwright inspector
PWDEBUG=1 npm run test:smoke:dev
```

### Build and package methods

It's possible to run the smoke tests for:

- A `build`, the JS bundle that is loaded into an electron client
- A `package`, the executable binary (e.g. `.dmg` or `.exe`)
  
For `build`:

```shell
npm run app-build:smoke             # Transpile js bundle
npm run test:smoke:build            # Run tests
```

For `package`:

```shell
npm run app-package:smoke           # Build executable in /packages/insomnia-app/dist
npm run test:smoke:package          # Run tests
```

Each of the above commands will automatically run the Express server, so you do not need to take any extra steps.

### Show trace viewer

Each time you run a playwright test a trace.zip will be generated, this is useful for debugging CI. [docs](https://playwright.dev/docs/trace-viewer)

```shell
# Open a trace viewer for a given test output
npx playwright show-trace packages/insomnia-smoke-test/screenshots/app-can-send-requests/trace.zip
# Alternatively you can upload this trace to https://trace.playwright.dev/
```

## Run Inso CLI smoke tests

```shell
npm run inso-package                # Package the Inso CLI binaries
npm run test:smoke:cli              # Run CLI tests
```

### Write Inso CLI smoke tests

In order to run CLI tests for development, open two terminal tabs in `packages/insomnia-smoke-test`:

```shell
# In the first tab, serve the Express API
npm run serve

# In the second tab, run your tests
npm run cli                         # Run CLI tests
```

This will allow you to write and monitor the server separately from each test, speeding up the development cycle.

## General guidelines

### Data

Individual tests will automatically run against a clean Insomnia data directory to keep data isolated.

### Dependencies

A test should not depend on any external services unless absolutely necessary. If a particular endpoint is required (eg. for authentication or a specific content type), implement a new endpoint in `/server`.

## Working with fixtures

### How to update the inso-nedb fixture

In order to update the inso-nedb fixutre you need to launch Insomnia using the inso-nedb directory. To do this, set the INSOMNIA_DATA_PATH environment variable and launch from the command line.

#### MacOS

```bash
INSOMNIA_DATA_PATH=packages/insomnia-smoke-test/fixtures/inso-nedb /Applications/Insomnia.app/Contents/MacOS/Insomnia
```

#### Linux

TODO

#### Windows

TODO

After making your changes, be sure to relaunch the app one more time from the command line, so that Insomnia compacts the database. The .gitignore file will explicity ignore certain database files, to keep the directory size down and avoid prevent data leakage in case you are signed in to the app when launching with this database.

### How to run inso with the inso-nedb fixture locally?

Set the `--src packages/insomnia-smoke-test/fixtures/inso-nedb` flag

```bash
# if installed globally
inso --src ...
# using the package bin
./packages/insomnia-inso/bin/inso --src ...
# using a binary
./packages/insomnia-inso/binaries/insomnia-inso --src ...
```
