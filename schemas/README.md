# Insomnia File Schema

[`insomnia.schema.json`](./insomnia.schema.json) is a [JSON Schema](https://json-schema.org/)
(draft 2020-12) describing the **Insomnia v5 file format** — the `.yaml` files you
get when you export a collection, design document, environment or mock server, and
the files Insomnia reads and writes in Git-backed repositories.

Use it to validate and autocomplete Insomnia files in your editor or CI, and to give
AI agents a precise contract for the files they generate.

> The schema is **generated** from Insomnia's source of truth (the Zod schema in
> [`packages/insomnia/src/common/import-v5-parser.ts`](../packages/insomnia/src/common/import-v5-parser.ts)).
> Do not edit the schema files by hand — see [Regenerating](#regenerating).

## Files

Two files are generated for every schema version:

| File                             | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `insomnia.schema.json`           | Stable "latest" alias — always mirrors the current schema version.  |
| `insomnia.schema.<version>.json` | Immutable, versioned snapshot (e.g. `insomnia.schema.5.1.json`).    |

Reference `insomnia.schema.json` to always validate against the latest format, or pin a
specific `insomnia.schema.<version>.json` if you need a stable, unchanging contract. The
current version is defined by `INSOMNIA_SCHEMA_VERSION` in
[`schema-version.ts`](../packages/insomnia/src/common/insomnia-schema-migrations/schema-version.ts).

## Stable URL

The schemas are published as raw files on the default branch:

```
https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.json
https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.5.1.json
```

This is the value of each schema's `$id` and the URL you should reference below. To pin
a specific app version, swap `develop` for a release tag (e.g. `core@12.0.0`).

## What it covers

A single top-level `type` field discriminates the five file kinds:

| `type`                          | File kind                       |
| ------------------------------- | ------------------------------- |
| `collection.insomnia.rest/5.0`  | Request collection              |
| `spec.insomnia.rest/5.0`        | API spec / design document      |
| `mock.insomnia.rest/5.0`        | Mock server                     |
| `environment.insomnia.rest/5.0` | Global environment              |
| `mcpClient.insomnia/5.0`        | MCP client                      |

## Usage

### VS Code (YAML extension)

Install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
and map your Insomnia files to the schema in `.vscode/settings.json`:

```jsonc
{
  "yaml.schemas": {
    "https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.json": [
      "**/*.insomnia.yaml",
      ".insomnia/**/*.yml"
    ]
  }
}
```

You can also point a single file at the schema with an inline modeline comment:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.json
type: collection.insomnia.rest/5.0
name: My Collection
```

### Command line / CI

Validate a file with any JSON Schema validator. Example with
[`ajv-cli`](https://github.com/ajv-validator/ajv-cli) (the file is YAML, so convert it
first — e.g. with [`yq`](https://github.com/mikefarah/yq)):

```bash
curl -sO https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.json
yq -o=json '.' my-collection.insomnia.yaml > my-collection.json
ajv validate --spec=draft2020 -s insomnia.schema.json -d my-collection.json
```

### Node.js

```js
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const schema = JSON.parse(readFileSync('insomnia.schema.json', 'utf8'));
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
const validate = ajv.compile(schema);

const data = YAML.parse(readFileSync('my-collection.insomnia.yaml', 'utf8'));
if (!validate(data)) {
  console.error(validate.errors);
  process.exit(1);
}
```

### AI agents

When asking an agent to author or edit an Insomnia file, give it the schema URL as the
contract to follow and validate against:

> Generate an Insomnia collection that conforms to the JSON Schema at
> `https://raw.githubusercontent.com/Kong/insomnia/develop/schemas/insomnia.schema.json`.
> The top-level `type` must be `collection.insomnia.rest/5.0`.

## Regenerating

The schema is regenerated from the Zod source and committed. CI fails if the committed
file drifts from the source (see [`.github/workflows/test.yml`](../.github/workflows/test.yml)).
After changing the Zod schema, run:

```bash
npm run generate:schema -w insomnia
```

and commit the updated files in `schemas/`.
