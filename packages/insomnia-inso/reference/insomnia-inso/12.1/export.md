---
title: export
---

## Command Description

Export data from insomnia models

## Syntax

`export [options] [command]`

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options

## Subcommands

- [`export spec`](/inso-cli/reference/export_spec/{{page.release}}/): Export an API Specification to a file, identifier can be an API Spec id

