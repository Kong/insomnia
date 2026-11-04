# Command Line

The `rl` command runs collections and tests from a terminal or CI. It is published as `restless-cli`.

## Commands

| Command | Purpose |
|---|---|
| `rl run collection [id]` | Run a collection |
| `rl run test [id]` | Run unit test suites |
| `rl lint spec [id]` | Lint an API spec |
| `rl export spec [id]` | Export an API spec |
| `rl script <name>` | Run a script from `.insorc` |

## Choosing the data source

By default, `rl` reads the Restless data folder. Use `-w` to read something else:

```bash
rl run collection -w ./collection.yaml
```

`-w` accepts a Git repository, an export file or a data folder.

## Common options

| Option | Purpose |
|---|---|
| `-e, --env <id>` | Environment to use |
| `-g, --globals <id>` | Global environment |
| `--env-var <key=value>` | Override a variable |
| `-n, --iteration-count <n>` | Number of runs |
| `-d, --iteration-data <path>` | JSON or CSV data file or URL |
| `-t, --requestNamePattern <regex>` | Filter requests |
| `-r, --reporter <name>` | Output format |
| `--requestTimeout <ms>` | Request timeout |
| `--ci` | Disable prompts |

Run `rl --help` for everything.

## CI example

```bash
rl run collection -w ./api.yaml --ci -e staging
```
