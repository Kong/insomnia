# Insomnia Smoke Tests

This project contains the smoke testing suite for Insomnia and Inso.

Tests for the Electron app are written using [Playwright](https://github.com/microsoft/playwright)  while tests for the CLI use [execa](https://github.com/sindresorhus/execa).

## Structure

| Folder      | Purpose                           |
| ----------- | --------------------------------- |
| `/cli`      | tests for inso                    |
| `/tests`    | tests for Insomnia                |
| `/server`   | Express server used by the tests  |
| `/fixtures` | data used by tests and the server |

## How to run

There are several ways to run a test but the first step is to bootstrap and build or package the relevant application.

From the root of this repository:

```shell
npm run bootstrap                   # Install packages and compile inso
npm run app-build:smoke             # Compile Insomnia
npm run inso-package                # Package the Inso CLI binaries
```

You can then run the smoke tests, again from the root:

```shell
npm run app-start-playwright                    # Run Insomnia tests
PWDEBUG=1 npm run test:smoke:dev                # Write Insomnia tests with the playwrite recorder
DEBUG=pw:browser,pw:api npm run test:smoke:dev  # Run Insomnia tests, with verbose output
```

Sometimes, you might need to run tests against a _packaged_ application. A packaged application is the final artifact which bundles all of the various resources together, and is created for distribution in the form of a `.dmg` or `.exe`, etc. Packaging takes longer to do and is only required for edge cases (such as a <!-- TODO(TSCONVERSION) update this link -->[plugin installation](https://github.com/Kong/insomnia/blob/357b8f05f89fd5c07a75d8418670abe37b2882dc/packages/insomnia-smoke-test/designer/app.test.js#L36)), so we typically run tests against a build. To run packaged tests, from the root:

```shell
npm run app-package:smoke      # Package Insomnia
npm run test:smoke:package     # Run Insomnia tests
```

Each of the above commands will automatically run the Express server, so you do not need to take any extra steps.

## How to write

When writing tests, it is recommended to use the scripts in this project directly (instead of from the root, as per the section above). After building and/or packaging your application under test, it will be available under `packages/insomnia-app/{build|dist}` and you can begin writing your test.

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
