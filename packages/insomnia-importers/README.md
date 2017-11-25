# Importers

[![Insomnia REST Client](https://img.shields.io/badge/maintainer-Insomnia-purple.svg?colorB=6e60cc)](https://insomnia.rest)
[![Npm Version](https://img.shields.io/npm/v/insomnia-importers.svg)](https://www.npmjs.com/package/insomnia-importers)
[![license](https://img.shields.io/github/license/getinsomnia/importers.svg)]()
[![TravisCI](https://api.travis-ci.org/getinsomnia/importers.svg?branch=master)](https://travis-ci.org/getinsomnia/importers)
[![Coverage Status](https://coveralls.io/repos/github/getinsomnia/importers/badge.svg?branch=master)](https://coveralls.io/github/getinsomnia/importers?branch=master)

This repository contains converters to translate popular HTTP data formats to
Insomnia v2 format.

- Insomnia v1
- Postman v2
- cURL
- HTTP Archive Format 1.2 (HAR)

## Installation

For usage on **command line**, install globally

```bash
npm install -g insomnia-importers
```

For programmatic usage, install in project
 
```bash
npm install --save insomnia-importers
```

## Command Line Usage

```shell
insomnia-import /path/to/har-export.json > insomnia-export.json
```

## Programmatic Usage

```javascript
const importers = require('insomnia-importers')

// Convert a Curl command
const output = importers.convert('curl -X POST https://insomnia.rest --data "Cool!"')

// Pretty print the result
console.log(JSON.stringify(output.data, null, 2));
```

## Running Tests

Run all tests

```shell
npm test
```

Run test watcher

```shell
npm run test:watch
```
