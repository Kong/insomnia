---
title: CLI Documentation
---

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options



## Commands

- [`run`](/inso-cli/reference/run/{{page.release}}/): Execution utilities
- [`lint`](/inso-cli/reference/lint/{{page.release}}/): Lint a yaml file in the workingDir or the provided file path (with  .spectral.yml) or a spec in an Insomnia database directory
- [`export`](/inso-cli/reference/export/{{page.release}}/): Export data from insomnia models
- [`script`](/inso-cli/reference/script/{{page.release}}/): Run scripts defined in .insorc
- [`generate-docs`](/inso-cli/reference/generate-docs/{{page.release}}/): No description available

## Subcommands

- [`run test`](/inso-cli/reference/run_test/{{page.release}}/): Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id
- [`run collection`](/inso-cli/reference/run_collection/{{page.release}}/): Run Insomnia request collection, identifier can be a workspace id


## Subcommands

- [`lint spec`](/inso-cli/reference/lint_spec/{{page.release}}/): Lint an API Specification, identifier can be an API Spec id or a file path


## Subcommands

- [`export spec`](/inso-cli/reference/export_spec/{{page.release}}/): Export an API Specification to a file, identifier can be an API Spec id




