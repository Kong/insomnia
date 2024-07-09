# CLI

## Getting started

```shell
npm run inso-start
npm run test -w insomnia-inso
# will default to insomnia app database
$PWD/packages/insomnia-inso/bin/inso run test
# will use config, useful for testing with fewer args
$PWD/packages/insomnia-inso/bin/inso -w packages/insomnia-inso/src/db/fixtures/git-repo script runTest
```

## install node version of libcurl

npm install will download the electron version of libcurl but for inso we need the node version

```shell
node_modules/.bin/node-pre-gyp install --directory node_modules/@getinsomnia/node-libcurl --update-binary
```

to download the electron version of node-libcurl run the following

```shell
npm run install-libcurl-electron
```

## Run CLI Smoke Tests

```shell
# Package the Inso CLI binaries
npm run inso-package

# Run CLI tests
npm run test:smoke:cli
```

## Debugging CLI tests using watcher

This is helpful for debugging failing api tests and changing the send-request abstraction

From project root, in separate terminals:

```sh
# start smoke test api
npm run serve -w packages/insomnia-smoke-test

# build send-request
npm run build:sr -w packages/insomnia

# watch inso
npm run start -w packages/insomnia-inso

# run api test with dev bundle
$PWD/packages/insomnia-inso/bin/inso run test "Echo Test Suite" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose
```

## How to debug pkg

```sh
# run modify package command and then a unit test
npm run package -w packages/insomnia-inso && \
$PWD/packages/insomnia-inso/binaries/inso run test "Echo Test Suite" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose

```

## How to update the `inso-nedb` fixtures

Run Insomnia with `INSOMNIA_DATA_PATH` environment variable set to `fixtures/inso-nedb`, e.g.:

```bash
INSOMNIA_DATA_PATH=packages/insomnia-smoke-test/fixtures/inso-nedb /Applications/Insomnia.app/Contents/MacOS/Insomnia
```

Relaunch the app one more time, so that Insomnia compacts the database.

The `.gitignore` file will explicitly ignore certain database files, to keep the directory size down and avoid prevent sensitive data leaks.

## How to run inso with the `inso-nedb` fixture locally?

Set the `--src` argument pointed to `packages/insomnia-smoke-test/fixtures/inso-nedb`:

```bash
# if installed globally
inso --src <INSO_NEDB_PATH>

# using the package bin
./packages/insomnia-inso/bin/inso --src <INSO_NEDB_PATH>

# using a binary
./packages/insomnia-inso/binaries/insomnia-inso --src <INSO_NEDB_PATH>
```
