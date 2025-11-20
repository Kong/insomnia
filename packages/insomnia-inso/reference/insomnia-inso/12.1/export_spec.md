---
title: export spec
---

## Command Description

Export an API Specification to a file, identifier can be an API Spec id

## Syntax

`export spec [options] [identifier]`

## Local Flags

- `-o, --output <path>`: save the generated config to a file
- `-s, --skipAnnotations`: remove all "x-kong-" annotations, defaults to false

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options

