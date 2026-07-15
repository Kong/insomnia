# Service API conventions

## Generic database-shaped APIs

Use these names when a service intentionally exposes the matching database operation for its model type:

- `list(query?, sort?, limit?)` -> `database.find(modelType, query, sort, limit)`
- `get(query?, sort?)` -> `database.findOne(modelType, query, sort)`
- `count(query?)` -> `database.count(modelType, query)`

Use `getById(id)` for the common `_id` lookup. Do not use `get(id)` for id lookup when `get` is the generic `findOne` API.

## Mutation APIs

Use existing model mutation names unless the method represents a broader workflow:

- `create(patch?)`
- `update(docOrId, patch)`
- `remove(docOrId)`

## Named query helpers

Add named helpers only when there is an actual caller or repeated business need. Do not pre-create parallel helper families such as `countBy...` unless they are used.

Name helpers by the filter they represent:

- `listByRemoteId(remoteId)`
- `listByGitRepositoryIds(gitRepositoryIds)`
- `listByOrganizationIds(organizationIds)`

When one helper must support both one id and many ids, prefer one plural API with `string | string[]` over separate singular and plural methods.

Workflow methods should be named by business intent, not database mechanics.
