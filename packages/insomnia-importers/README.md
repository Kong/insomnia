# Importers

[![Npm Version](https://img.shields.io/npm/v/insomnia-importers.svg)](https://www.npmjs.com/package/insomnia-importers)

This repository contains converters to translate popular HTTP data formats to
Insomnia v3 format.

- Insomnia v1 and v2
- Postman v2.0
- cURL
- HTTP Archive Format 1.2 (HAR)
- Swagger 2.0
- OpenAPI 3.0

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
const importers = require('insomnia-importers');

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
npm test
```

Run test watcher

```shell
npm run test:watch
```
