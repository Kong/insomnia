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
      "url": "https://schema.insomnia.rest/json/draft-07/config/v1.0.0/"
    }
  ]
}
```
