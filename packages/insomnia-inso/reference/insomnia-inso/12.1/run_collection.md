---
title: run collection
---

## Command Description

Run Insomnia request collection, identifier can be a workspace id

## Syntax

`run collection [options] [identifier]`

## Local Flags

- `-t, --requestNamePattern <regex>`: run requests that match the regex
- `-i, --item <requestid>`: request or folder id to run
- `-e, --env <identifier>`: environment to use
- `-g, --globals <identifier>`: global environment to use (filepath or id)
- `--delay-request <duration>`: milliseconds to delay between requests
- `--env-var <key=value>`: override environment variables
- `-n, --iteration-count <count>`: number of times to repeat
- `-d, --iteration-data <path/url>`: file path or url (JSON or CSV)
- `-r, --reporter <reporter>`: reporter to use, options are [dot, list, min, progress, spec, tap]
- `-b, --bail`: abort ("bail") after first non-200 response
- `--disableCertValidation`: disable certificate validation for requests with SSL
- `--httpsProxy <proxy>`: URL for the proxy server for https requests.
- `--httpProxy <proxy>`: URL for the proxy server for http requests.
- `--noProxy <comma_separated_list_of_hostnames>`: Comma separated list of hostnames that do not require a proxy to get reached, even if one is specified.
- `-f, --dataFolders [dataFolders...]`: This allows you to control what folders Insomnia (and scripts within Insomnia) can read/write to.
- `--output <file>`: Output the results to a file in JSON format.
- `--includeFullData <type>`: Include full data in the output file, including request, response, environment and etc.
- `--acceptRisk`: Accept the security warning when outputting to a file, please make sure you understand the risks.

## Global Flags

- `-v, --version`: output the version number
- `-w, --workingDir <dir>`: set working directory/file: .insomnia folder, *.db.json, export.yaml
- `--verbose`: show additional logs while running the command
- `--ci`: run in CI, disables all prompts, defaults to false
- `--config <path>`: path to configuration file containing above options (.insorc)
- `--printOptions`: print the loaded options

