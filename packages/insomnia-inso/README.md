# inso

A CLI to accompany [Insomnia Designer](https://insomnia.rest).

<div align="center">
  <pre>npm i -g <a href="https://www.npmjs.com/package/insomnia-inso">insomnia-inso</a></pre>
</div>

### `$ inso [global options] [command]`

|Global option|Alias|Description|
|- |- |- |
| `--version` | `-v` |output the version number|
| `--working-dir <dir>` | `-w` |set working directory|
| `--app-data-dir <dir>` | `-a` |set the app data directory|
| `--ci` | | run in CI, disables all prompts |
| `--help` | `-h` |display help for a command|

#### Data source

`inso` will first try to find a `.insomnia` directory in it's working directory. This directory is generated in a git repository when using git sync in Designer. When `inso` is used in a CI environment, it will always run against the `.insomnia` directory.

If `inso` cannot find the `.insomnia` directory, it will try to run against the Designer app data directory (if found). You can override both the working directory, and the app data directory, using the global options shown above.

#### Identifiers
Typically, Insomnia database id's are quite long, for example: `wrk_012d4860c7da418a85ffea7406e1292a`. When specifying an identifier for `inso`, similar to Git hashes, you may choose to concatenate and use the first x characters (for example, `wrk_012d486`), which is very likely to be unique. If in the rare chance the short id is _not_ unique against the data, `inso` will inform as such.

## Commands

### `$ inso generate config [options] [identifier]`

Similar to the Kong [Kubernetes](https://insomnia.rest/plugins/insomnia-plugin-kong-kubernetes-config) and [Declarative](https://insomnia.rest/plugins/insomnia-plugin-kong-declarative-config) config plugins for Designer, this command can generate configuration from an API specification, using [openapi-2-kong](https://www.npmjs.com/package/openapi-2-kong).

|Option|Alias|Description|
|- |- |- |
| `--type <type>` | `-t` |type of configuration to generate, options are `kubernetes` and `declarative` (default: `declarative`) |
| `--output <path>` | `-o` |save the generated config to a file in the working directory|

The `identifier` argument is optional. It can be the API Specification name, or ID, or a file path relative to the working directory. If it is not specified, `inso` will prompt you with a searchable list of all API specifications (and database ids) it has found in its data source.

<details>
<summary>Examples</summary>

When running against the [git-repo](/src/db/__fixtures__/git-repo) directory
```sh
inso generate config # Will prompt for spec

inso generate config spc_46c5a4 --type declarative

inso generate config spc_46c5a4 --type declarative > output.yaml

inso generate config "Sample Specification" --output output.yaml

inso generate config "Sample Specification" --type kubernetes

inso generate config spec.yaml --working-dir another/dir
```
</details>

### `$ inso lint spec [options] [identifier]`



### Development

* Bootstrap: `npm run bootstrap`
* Start the compiler in watch mode: `npm run watch`
* Run: `./bin/inso -v`
