# Insomnia Config

## Design Goals

- ensure that changing the root TypeScript types will generate new config
- ensure that making a breaking change to TypeScript will cause failing tests to be updated
- run validation on the CI

## Editor Integration

To get editor integration for this schema, tell your IDE about it.  For example, in VS Code add the following to your `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": [
        "insomnia.config.json",
      ],
      "url": "https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-config/src/generated/schemas/insomnia.schema.json"
    }
  ]
}
```
