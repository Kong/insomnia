---
title: run
---

## Command Description

Execution utilities

## Syntax

`run [options] [command]`

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options

## Subcommands

- [`run test`](/inso-cli/reference/run_test/{{page.release}}/): Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id
- [`run collection`](/inso-cli/reference/run_collection/{{page.release}}/): Run Insomnia request collection, identifier can be a workspace id

