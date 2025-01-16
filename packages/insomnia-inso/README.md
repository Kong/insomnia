# Documentation

How to use [Inso CLI](https://docs.insomnia.rest/inso-cli/introduction).

## Testing

```shell
# unit tests
npm run test:unit

# start smoke test api (required for e2e tests)
npm run serve -w insomnia-smoke-test

# e2e tests for dev bundle
npm run test:bundle

# e2e tests for binary
npm run test:binary
```

## Development

### Getting started

```shell
npm run inso-start
npm run test -w insomnia-inso
# will default to insomnia app database
$PWD/packages/insomnia-inso/bin/inso run test
# will use config, useful for testing with fewer args
$PWD/packages/insomnia-inso/bin/inso -w packages/insomnia-inso/src/db/fixtures/git-repo script runTest
```

### node-libcurl

`Error: The module '.../insomnia/node_modules/@getinsomnia/node-libcurl/lib/binding/node_libcurl.node'
was compiled against a different Node.js version using`

node-libcurl builds for 3 operating systems and two versions of nodejs. insomnia-inso uses the nodejs build and insomnia app uses the electron build. you can switch between them using the following two commands

```shell
# install node version
node_modules/.bin/node-pre-gyp install --update-binary --directory node_modules/@getinsomnia/node-libcurl
# install electron version
npm run install-libcurl-electron
```

## Run CLI Smoke Tests

```shell
# Run CLI tests
npm run test:bundle -w insomnia-inso
# Package the Inso CLI binaries
npm run inso-package
npm run test:binary -w insomnia-inso
```

## Debugging CLI tests using watcher

This is helpful for debugging failing api tests

From project root, in separate terminals:

```sh
# start smoke test api
npm run serve -w insomnia-smoke-test

# watch inso
npm run start -w insomnia-inso

# run api test with dev bundle. To debug run this in a Javascript Debug Terminal in VSCode
$PWD/packages/insomnia-inso/bin/inso run test "Echo Test Suite" -w $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose
```

## How to debug pkg

```sh
# run modify package command and then a unit test
npm run package -w insomnia-inso && \
$PWD/packages/insomnia-inso/binaries/inso run test "Echo Test Suite" -w $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose

```

## How to update the `inso-nedb` fixtures

Run Insomnia with `INSOMNIA_DATA_PATH` environment variable set to `fixtures/inso-nedb`, e.g.:

```bash
INSOMNIA_DATA_PATH=packages/insomnia-smoke-test/fixtures/inso-nedb /Applications/Insomnia.app/Contents/MacOS/Insomnia
```

Relaunch the app one more time, so that Insomnia compacts the database.

The `.gitignore` file will explicitly ignore certain database files, to keep the directory size down and avoid prevent sensitive data leaks.

## How to run inso with the `inso-nedb` fixture locally?

Set the `-w` argument pointed to `packages/insomnia-smoke-test/fixtures/inso-nedb`:

```bash
# if installed globally
inso -w <INSO_NEDB_PATH>

# using the package bin
./packages/insomnia-inso/bin/inso -w <INSO_NEDB_PATH>

# using a binary
./packages/insomnia-inso/binaries/insomnia-inso -w <INSO_NEDB_PATH>
```
