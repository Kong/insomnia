
<div align="center">
  <br />
  <br />
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/logo.svg" alt=""/>
  <h1>
    Inso
    <br />
    <br />
  </h1>
  <h3>A CLI for <a href="https://insomnia.rest">Insomnia Designer</a></h3>
  <pre>npm install --global <a href="https://www.npmjs.com/package/insomnia-inso">insomnia-inso</a></pre>
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/demo.gif" alt=""/>
  <br />
</div>

Table of Contents
=================

* [Data source](#data-source)
* [The `[identifier]` argument](#the-identifier-argument)
* [Global options](#global-options)
* [Commands](#commands)
  + [ `inso generate config` ](#-inso-generate-config-identifier)
  + [ `inso lint spec` ](#-inso-lint-spec-identifier)
  + [ `inso run test` ](#-inso-run-test-identifier)
  + [ `inso export spec` ](#-inso-export-spec-identifier)
  + [ `inso script` ](#-inso-script-name)
* [Configuration](#configuration)
* [Git Bash](#git-bash)
* [Continuous Integration](#continuous-integration)
* [Development](#development)

# Data source

`inso` will first try to find a `.insomnia` directory in it's working directory. This directory is generated in a git repository when using git sync in Designer. When `inso` is used in a CI environment, it will always run against the `.insomnia` directory.

If `inso` cannot find the `.insomnia` directory, it will try to run against the Designer app data directory (if found). You can override both the working directory, and the app data directory, using the `--workingDir` and `--appDataDir` global options.

# The `[identifier]` argument

Typically, Insomnia database id's are quite long, for example: `wrk_012d4860c7da418a85ffea7406e1292a` . When specifying an identifier for `inso` , similar to Git hashes, you may choose to concatenate and use the first x characters (for example, `wrk_012d486` ), which is very likely to be unique. If in the rare chance the short id is _not_ unique against the data, `inso` will inform as such.

Additionally, if the `[identifier]` argument is omitted from the command, `inso` will search in the database for the information it needs, and prompt the user. Prompts can be disabled with the `--ci` global option.

![](https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/ci-demo.gif)

# Global options

 `$ inso [global options] [command]`
|Global option|Alias|Description|
|- |- |- |
| `--workingDir <dir>` | `-w` |set working directory|
| `--appDataDir <dir>` | `-a` |set the app data directory|
| `--config <path>` | |path to the configuration file|
| `--ci` | | run in CI, disables all prompts |
| `--verbose` | | show additional logs while running a command |
| `--printOptions` | | print the loaded options |
| `--version` | `-v` |output the version number|
| `--help` | `-h` |display help for a command|

# Commands

## `$ inso generate config [identifier]`

Similar to the Kong [Kubernetes](https://insomnia.rest/plugins/insomnia-plugin-kong-kubernetes-config) and [Declarative](https://insomnia.rest/plugins/insomnia-plugin-kong-declarative-config) config plugins for Designer, this command can generate configuration from an API specification, using [openapi-2-kong](https://www.npmjs.com/package/openapi-2-kong).

**`[identifier]`**: this can be a **document name, id, or a file path** relative to the working directory.

|Option|Alias|Description|
|- |- |- |
| `--type <type>` | `-t` |type of configuration to generate, options are `kubernetes` and `declarative` (default: `declarative` ) |
| `--output <path>` | `-o` |save the generated config to a file in the working directory|
| `--tags <tags>` | |comma separated list of tags to apply to each entity|

### Examples

When running in the <a href="https://github.com/Kong/insomnia/tree/develop/packages/insomnia-inso/src/db/fixtures/git-repo">git-repo</a> directory

Not specifying any arguments will prompt

``` sh
inso generate config
```

Scope by the document name or id

``` sh
inso generate config spc_46c5a4 --type declarative
inso generate config "Sample Specification" --type kubernetes
```

Scope by a file on the filesystem

``` sh
inso generate config spec.yaml
inso generate config spec.yaml --workingDir another/dir

```

Add tags
```sh
inso generate config spec.yaml --tags first
inso generate config spec.yaml --tags "first,second"
```

Output to file

``` sh
inso generate config spc_46c5a4 --output output.yaml
inso generate config spc_46c5a4 > output.yaml
```

</details>

## `$ inso lint spec [identifier]`

Designer has the ability to lint and validate your OpenAPI specification as you write it. This command adds the same functionality to `inso` , in order to run linting during CI workflows. Lint results will be printed to the console, and `inso` will exit with an appropriate exit code.

**`[identifier]`**: this can be a **document name, or id**.

### Examples

When running in the <a href="https://github.com/Kong/insomnia/tree/develop/packages/insomnia-inso/src/db/fixtures/git-repo">git-repo</a> directory

Not specifying any arguments will prompt

``` sh
inso lint spec
```

Scope by the document name or id

``` sh
inso lint spec spc_46c5a4
inso lint spec "Sample Specification"
```

## `$ inso run test [identifier]`

API Unit Testing was introduced with Designer 2020.3.0, and this command adds the functionality to execute those unit tests via the command line, very useful for a CI environment. `inso` will report on test results, and exit with an appropriate exit code.

**`[identifier]`**: this can be the **name or id** of a **workspace, document, or unit test suite**.

The test runner is built on top of Mocha, thus many of the options behave as they would in Mocha. The options currently supported are:

|Option|Alias|Description|
|- |- |- |
| `--env <identifier>` | `-e` |the environment to use - an environment name or id |
| `--reporter <value>` | `-r` |specify reporter to use (default: `spec` )|
| `--reporter-options <option> [options...]` | `-ro` |reporter-specific options|
| `--testNamePattern <regex>` | `-t` | run tests that match the regex|
| `--bail` | `-b` | abort ("bail") after the first test failure|
| `--keepFile` | | do not delete the generated test file (useful for debugging)|

### Examples

When running in the <a href="https://github.com/Kong/insomnia/tree/develop/packages/insomnia-inso/src/db/fixtures/git-repo">git-repo</a> directory

Not specifying any arguments will prompt

``` sh
inso run test
```

Scope by the document name or id

``` sh
inso run test "Sample Specification" --env "OpenAPI env"
inso run test spc_46c5a4 --env env_env_ca046a
```

Scope by test suite name or id

``` sh
inso run test "Math Suite" --env "OpenAPI env"
inso run test uts-7f0f85 --env env_env_ca046a
```

Scope by test name regex, and control test running and reporting

``` sh
inso run test "Sample Specification" --testNamePattern Math --env env_env_ca046a
inso run test spc_46c5a4 --reporter progress --bail --keepFile
```

More examples: [#2338](https://github.com/Kong/insomnia/pull/2338).

Scope by document name or id using an external reporter

``` sh
inso run test spc_ff27a1 --reporter my-custom-reporter
inso run test spc_ff27a1 --reporter my-custom-reporter --reporterOptions key1=value1 key2=value2
```
**Important**:
Mocha and the external reporter must be installed as global in order to work

## `$ inso export spec [identifier]`

This command will extract and export the raw OpenAPI specification from the data store. If the `--output` option is not specified, the spec will print to console.

**`[identifier]`**: this can be a **document name, or id**.

|Option|Alias|Description|
|- |- |- |
| `--output <path>` | `-o` |save the generated config to a file in the working directory|

### Examples

When running in the <a href="https://github.com/Kong/insomnia/tree/develop/packages/insomnia-inso/src/db/fixtures/git-repo">git-repo</a> directory

Not specifying any arguments will prompt

``` sh
inso export spec
```

Scope by the document name or id

``` sh
inso export spec spc_46c5a4
inso export spec "Sample Specification"
```

Output to file

``` sh
inso export spec spc_46c5a4 --output output.yaml
inso export spec spc_46c5a4 > output.yaml
```

## `$ inso script <name>`

The `inso` [config file](#configuration) supports scripts, akin to NPM scripts defined in a `package.json` file. These scripts can be executed by `inso` by running `inso script <name>` , or simply `inso <name>` as this is the default command. Any options passed to this command, will be forwarded to the script being executed.

### Examples

When running in the <a href="https://github.com/Kong/insomnia/tree/develop/packages/insomnia-inso/src/db/fixtures/git-repo">git-repo</a> directory, with the following inso config file.

``` yaml
# .insorc.yaml
scripts:
  lint: lint spec "Sample Specification"

  gen-conf: generate config "Sample Specification"
  gen-conf:k8s: gen-conf --type kubernetes
```

Run commands with or without the `script` prefix

``` bash
inso script gen-conf
inso gen-conf
```

If a conflict exists with another command (eg. `lint` ), you must prefix with `script`

``` bash
inso script lint
inso lint # will not work
```

Any options passed during script invocation will be forwarded to the script

``` bash
inso gen-conf                       # generates declarative config (default)
inso gen-conf:k8s                   # generates kubernetes config
inso gen-conf:k8s -t declarative    # generates declarative config
inso gen-conf:k8s -o output.yaml    # generates kubernetes config to output.yaml
```

# Configuration

Inso can be configured with a configuration file, allowing you to specify options and scripts. For example, when running in a CI environment, you may choose to specify the steps as scripts in a config file, so that the same commands can be run both locally and in CI.

Inso uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for config file management, meaning any of the following items found in the working tree are automatically used:

  + `inso` property in `package.json`
  + `.insorc` file in JSON or YAML format
  + `.insorc.json` file
  + `.insorc.yaml` , `.insorc.yml` , or `.insorc.js` file
  + `inso.config.js` file exporting a JS object

Alternatively, you can use the `--config <file>` global option to specify an exact file to use, if it exists outside the directory tree.

**Options**

Options from the config file are combined with option defaults and any explicit overrides specified in script or command invocations. This combination is in priority order: command options > config file options > default options.

Any options specified in this file will apply to all scripts and manual commands. You can override these options by specifying them explicitly, when invoking a script or command.

Only [global options](#global-options) can be set in the config file.

**Scripts**

Scripts can have any name, and can be nested. Scripts must be prefixed with `inso` (see example below). Each command behaves the same way, as described in the sections above.

### Example

``` yaml
# .insorc.yaml

options:
  ci: false
scripts:
  test-spec: inso run test Demo --env DemoEnv --reporter progress
  test-spec:200s: inso testSpec --testNamePattern 200
  test-spec:404s: inso testSpec --testNamePattern 404

  test-math-suites: inso run test uts_8783c30a24b24e9a851d96cce48bd1f2 --env DemoEnv
  test-request-suite: inso run test uts_bce4af --env DemoEnv --bail

  lint: inso lint spec Demo # must be invoked as `inso script lint`

  gen-conf: inso generate config "Designer Demo" --type declarative
  gen-conf:k8s: inso gen-conf --type kubernetes
```

# Git Bash

Git Bash on Windows is not interactive and therefore prompts from `inso` will not work as expected. You may choose to specify the identifiers for each command explicitly, or run `inso` using `winpty` :

```
winpty inso.cmd generate config
```

# Continuous Integration

`inso` has been designed to run in a CI environment, disabling prompts and providing exit codes to pass or fail the CI workflow accordingly. An example workflow run in Github Actions is as follows. This example will checkout > install NodeJS > install inso > run linting > run unit tests > generate configuration. If any of these steps fail, the GH workflow will as well.

``` yaml
# .github/workflows/test.yml

name: Test

jobs:
  Linux:
    name: Validate API spec
    runs-on: ubuntu-latest
    steps:
      - name: Checkout branch
        uses: actions/checkout@v1
      - name: Install NodeJS
        uses: actions/setup-node@v1
      - name: Install inso
        run: npm install --global insomnia-inso
      - name: Lint
        run: inso lint spec "Designer Demo" --ci
      - name: Run test suites
        run: inso run test "Designer Demo" --env UnitTest --ci
      - name: Generate declarative config
        run: inso generate config "Designer Demo" --type declarative --ci
```

# Development

* Bootstrap: `npm run bootstrap`
* Start the compiler in watch mode: `npm run start`
* Run: `./bin/inso -v`
