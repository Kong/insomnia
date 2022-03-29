# Importers

[![Npm Version](https://img.shields.io/npm/v/insomnia-importers.svg)](https://www.npmjs.com/package/insomnia-importers)

This repository contains converters to translate popular HTTP data formats to the latest Insomnia format.

Supported import types include:

- Insomnia v1, v2, v3, v4
- Postman v2.0
- Postman Environment
- HTTP Archive Format 1.2 (HAR)
- cURL
- Swagger 2.0
- OpenAPI 3.0
- WSDL

## Installation

For usage on **command line**, install globally

```shell
npm install -g insomnia-importers
```

For programmatic usage, install in project

```shell
npm install insomnia-importers
```

## Command Line Usage

```shell
insomnia-import /path/to/har-export.json > insomnia-export.json
```

## Programmatic Usage

```ts
import { importers } from 'insomnia-importers';

(async function () {
  // Convert a Curl command
  const output = await importers.convert(
    'curl -X POST https://insomnia.rest --data "Cool!"'
  );

  // Pretty print the result
  console.log(JSON.stringify(output.data, null, 2));
})();
```

## Running Tests

Run all tests

```shell
npm run test
```

Run test watcher

```shell
npm run test:watch
```
