---
title: run test
---

## Command Description

Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id

## Syntax

`run test [options] [identifier]`

## Local Flags

- `-e, --env <identifier>`: environment to use
- `-t, --testNamePattern <regex>`: run tests that match the regex
- `-r, --reporter <reporter>`: reporter to use, options are [dot, list, min, progress, spec, tap]
- `-b, --bail`: abort ("bail") after first test failure
- `--keepFile`: do not delete the generated test file
- `-k, --disableCertValidation`: disable certificate validation for requests with SSL
- `--httpsProxy <proxy>`: URL for the proxy server for https requests.
- `--httpProxy <proxy>`: URL for the proxy server for http requests.
- `--noProxy <comma_separated_list_of_hostnames>`: Comma separated list of hostnames that do not require a proxy to get reached, even if one is specified.
- `-f, --dataFolders [dataFolders...]`: This allows you to control what folders Insomnia (and scripts within Insomnia) can read/write to.

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options

