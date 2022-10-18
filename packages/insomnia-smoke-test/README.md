# Insomnia Smoke Tests

This project contains the smoke testing suite for Insomnia App and Inso CLI.

We use [Playwright](https://github.com/microsoft/playwright) for App tests and [execa](https://github.com/sindresorhus/execa) for CLI tests.

- [Insomnia Smoke Tests](#insomnia-smoke-tests)
  - [App](#app)
    - [Run App Smoke Tests](#run-app-smoke-tests)
    - [Build and package methods](#build-and-package-methods)
    - [Playwright Inspector](#playwright-inspector)
    - [Playwright Trace viewer](#playwright-trace-viewer)
    - [Playwright VS Code extension](#playwright-vs-code-extension)
    - [Debugging Smoke Tests](#debugging-smoke-tests)
  - [CLI](#cli)
    - [Run CLI Smoke Tests](#run-cli-smoke-tests)
    - [Debugging CLI tests using watcher](#debugging-cli-tests-using-watcher)
    - [How to update the `inso-nedb` fixtures](#how-to-update-the-inso-nedb-fixtures)
    - [How to run inso with the `inso-nedb` fixture locally?](#how-to-run-inso-with-the-inso-nedb-fixture-locally)
  - [Notes](#notes)
    - [Development guidelines](#development-guidelines)
    - [Folder Structure](#folder-structure)

## App

### Run App Smoke Tests

To run Smoke tests:

- In one terminal window run `npm run watch:app`
- In another terminal run: `npm run test:smoke:dev`

To run individual tests, you can filter by the file or test title, for example `npm run test:smoke:dev -- oauth`

### Build and package methods

It's possible to run the smoke tests for:

- A `build`, the JS bundle that is loaded into an electron client
- A `package`, the executable binary (e.g. `.dmg` or `.exe`)

For `build`:

```shell
# Transpile js bundle
npm run app-build

# Run tests
npm run test:smoke:build
```

For `package`:

```shell
# Build executable in /packages/insomnia/dist
npm run app-package

# Run tests
npm run test:smoke:package
```

Each of the above commands will automatically run the Express server, so you do not need to take any extra steps.

### Playwright Inspector

You can step through tests with playwright inspector: `PWDEBUG=1 npm run test:smoke:dev`

This is also useful to help create new tests.

![playwright inspector](docs/imgs/playwright-inspector.jpg)

### Playwright Trace viewer

We generate [Playwright Traces](https://playwright.dev/docs/trace-viewer) when tests run. These can be used to debug local and CI test failures.

![playwright trace viewer](docs/imgs/playwright-trace.jpg)

To open a local trace viewer for a given test output, run:

```shell
# Example:
npx playwright show-trace packages/insomnia-smoke-test/screenshots/app-can-send-requests/trace.zip
```

Alternatively you can upload this trace to [trace.playwright.dev](https://trace.playwright.dev/).

Traces from CI execution can be found in the failed CI job's artifacts.

![artifacts](docs/imgs/artifacts.png)

### Playwright VS Code extension

In order to run/debug tests directly from VS Code:

- Install the [Playwright extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).
- With the extension installed, run on terminal `npm run watch:app`.

You can trigger tests from the `Testing` tab, or within the test files clicking the run button.

![editor](docs/imgs/editor.png)

If no tests appear, you may need to run "Refresh playwright tests". This can be done from the command palette, or by using the button at the top of the `Testing` tab.

![refresh](docs/imgs/refresh.png)

### Debugging Smoke Tests

You can enable additional logging to help you debug tests:

- Playwright logs: `DEBUG=pw:api npm run test:smoke:dev`
- Insomnia console logs: `DEBUG=pw:browser npm run test:smoke:dev`
- WebServer console logs: `DEBUG=pw:WebServer npm run test:smoke:dev`

## CLI

### Run CLI Smoke Tests

```shell
# Package the Inso CLI binaries
npm run inso-package

# Run CLI tests
npm run test:smoke:cli
```

### Debugging CLI tests using watcher

This is helpful for debugging failing api tests and changing the send-request abstraction

From project root, in separate terminals:

```sh
# start smoke test api
npm run serve --prefix packages/insomnia-smoke-test

# build send-request
npm run build:sr --prefix packages/insomnia

# watch inso
npm run start --prefix packages/insomnia-inso

# run api test
$PWD/packages/insomnia-inso/bin/inso run test "Echo Test Suite" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose
```

### How to update the `inso-nedb` fixtures

Run Insomnia with `INSOMNIA_DATA_PATH` environment variable set to `fixtures/inso-nedb`, e.g.:

```bash
INSOMNIA_DATA_PATH=packages/insomnia-smoke-test/fixtures/inso-nedb /Applications/Insomnia.app/Contents/MacOS/Insomnia
```

Relaunch the app one more time, so that Insomnia compacts the database.

The `.gitignore` file will explicitly ignore certain database files, to keep the directory size down and avoid prevent sensitive data leaks.

### How to run inso with the `inso-nedb` fixture locally?

Set the `--src` argument pointed to `packages/insomnia-smoke-test/fixtures/inso-nedb`:

```bash
# if installed globally
inso --src <INSO_NEDB_PATH>

# using the package bin
./packages/insomnia-inso/bin/inso --src <INSO_NEDB_PATH>

# using a binary
./packages/insomnia-inso/binaries/insomnia-inso --src <INSO_NEDB_PATH>
```

## Notes

### Development guidelines

- Tests run against a clean Insomnia data directory to keep test run data isolated.
- Avoid depending on any external services. If a particular endpoint is required, implement a new endpoint in `/server`.

### Folder Structure

| Folder       | Purpose                           |
| ------------ | --------------------------------- |
| `/cli`       | tests for inso                    |
| `/tests`     | tests for Insomnia                |
| `/playwright`| test helpers                      |
| `/server`    | Express server used by the tests  |
| `/fixtures`  | data used by tests and the server |
