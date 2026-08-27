# `insomnia-scripting-environment/src/objects` Reference

One doc per source file in `packages/insomnia-scripting-environment/src/objects/`. Each covers: public API (real signatures), how a script actually reaches it (`pm.*`/`insomnia.*`), and gotchas found while reading the code.

## Core / context
- [insomnia.md](insomnia.md) — `InsomniaObject`, the top-level `insomnia`/`pm` instance
- [interfaces.md](interfaces.md) — `RequestContext`, `IEnvironment`
- [execution.md](execution.md) — `Execution` (`pm.execution`)
- [request-info.md](request-info.md) — `RequestInfo` (`pm.info`)
- [async-objects.md](async-objects.md) — `ProxiedPromise` and async-task tracking
- [interpolator.md](interpolator.md) — `{{ }}` template interpolation
- [utils.md](utils.md) — misc helpers

## Request / response
- [request.md](request.md) — `Request`, `RequestBody` (`pm.request`)
- [response.md](response.md) — `Response` (`pm.response`)
- [headers.md](headers.md) — `Header`, `HeaderList`
- [urls.md](urls.md) — `Url`, `QueryParam`, `UrlMatchPattern`

## Environment / variables / collection
- [environments.md](environments.md) — `Environment`, `Variables` (`pm.environment` / `pm.globals`, variable resolution precedence)
- [variables.md](variables.md) — `Variable`, `VariableList`
- [collection.md](collection.md) — re-export barrel only; no `Collection` class or logic — see `environments.md`/`insomnia.md` instead
- [folders.md](folders.md) — `Folder`, `ParentFolders`
- [properties.md](properties.md) — `PropertyBase`, `PropertyList` base classes

## Auth / cookies / certs / proxy
- [auth.md](auth.md) — `RequestAuth` (`pm.request.auth`)
- [cookies.md](cookies.md) — `Cookie`, `CookieJar`, `CookieList` (`pm.cookies`)
- [certificates.md](certificates.md) — `Certificate` (`pm.request.certificate`)
- [proxy-configs.md](proxy-configs.md) — `ProxyConfig`, `ProxyConfigList`

## Test / console / send-request
- [test.md](test.md) — `pm.test()`/`test()` handler registration
- [console.md](console.md) — `Console` (script `console.log` capture)
- [send-request.md](send-request.md) — `pm.sendRequest()`

## Flagged during writing (worth a closer look if you hit related symptoms)
- `insomnia.settings` always returns `undefined` in scripts (getter unconditionally returns nothing) — see `insomnia.md`.
- `pm.collectionVariables` and `pm.baseEnvironment` are the same object reference, not a copy — see `insomnia.md`/`environments.md`.
- Writes to `insomnia.info.*` (`RequestInfo`) are never read back by the script-run merge logic — silently discarded — see `request-info.md`.
- `pm.sendRequest(url, callback)` resolves (does not reject) on network/parse errors when a callback is passed — only the promise-only form rejects — see `send-request.md`.
- `Response.dataURI()` has a typo bug: emits `baseg4` instead of `base64` — see `response.md`.
- `Certificate.update()` doesn't update `disabled`, unlike the constructor — see `certificates.md`.
- `ProxyConfig` has no `key` property despite `_index = 'key'`, breaking base-class `one()`/`indexOf()`/`upsert()` lookups — see `proxy-configs.md`.
- `Vault` is read-only from scripts even when `enableVaultInScripts` is set — `set`/`unset`/`clear` always throw — see `environments.md`.
