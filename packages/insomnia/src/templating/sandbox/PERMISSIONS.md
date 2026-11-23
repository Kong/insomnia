# Plugin permissions (`insomnia.permissions`)

When the **Run template tags in sandbox** setting is on (Preferences → Scripting), a plugin's
template-tag `run()` executes inside an isolated QuickJS sandbox. Inside that sandbox a plugin can
only reach what it is _granted_ — a default-deny model with two independent axes declared in the
plugin's `package.json`:

```jsonc
{
  "insomnia": {
    "permissions": {
      "modules": ["events"], // what require(x) may return
      "capabilities": ["network"], // which host bridge groups context.* may call
    },
  },
}
```

## Axis 1 — `modules`

Names you may `require()` inside the sandbox. Each resolves to a **vetted safe equivalent** shipped
by Insomnia (a pure-JS reimplementation or a host-backed shim), never the raw Node builtin.

- **Baseline (no manifest needed):** `path`, `crypto`.
- **Grantable:** any other module in the sandbox registry. Declaring one adds it to your grant.
  - Pure-JS reimplementations: `events`, `util` (and more via M2).
    - `util` implements `format`, `promisify` (including a `Symbol.for("nodejs.util.promisify.custom")`
      override and a `.custom` property), and `types.is*` (`isDate`/`isRegExp`/`isPromise`/`isMap`/
      `isSet`/`isWeakMap`/`isWeakSet`/`isArrayBuffer`/`isDataView`/`isTypedArray`/`isNativeError`/
      `isBooleanObject`/`isNumberObject`/`isStringObject`/`isAsyncFunction`/`isGeneratorFunction`) —
      verified against `node:util` for all of `format`'s specifiers (`%s %d %i %f %j %o %O %c %%`),
      its `-0`/`NaN`/`bigint`/`symbol` coercion quirks, quote-character selection for inspected
      strings, and `promisify`'s error/multi-value/custom-override semantics. Two deliberate,
      documented gaps: `util.inspect`/`inherits`/`deprecate` are not implemented at all (absent from
      the exports object, so calling them throws a plain "not a function" TypeError); and `%o` is not
      distinguished from `%O` — real Node's `%o` additionally reveals non-enumerable properties (e.g.
      an array's `.length`) and inspects to depth 4, neither of which this module replicates. Most
      `types.is*` checks use `instanceof` rather than Node's real V8-internal-type-tag approach —
      deliberately, since `instanceof` can't be spoofed via a custom `Symbol.toStringTag` getter the
      way a `toString.call`-based check can. The two exceptions, `isAsyncFunction` and
      `isGeneratorFunction`, use `Object.prototype.toString.call` instead (there's no `instanceof`
      target for either) and so can be made to answer wrongly by a value with a forged
      `[Symbol.toStringTag]`. This is a correctness gap, not a capability leak: the check only ever
      returns a boolean about a value the plugin already owns, so a spoofed answer can't expose or
      grant access to anything the plugin couldn't already reach.
  - **Vetted npm libraries** (pinned + pre-bundled by Insomnia): `uuid`, `ajv`. These are real
    libraries bundled to run inside the sandbox; they're only loaded when a plugin declares them.
    Each is sourced from an isolated, exact-pinned install at
    `src/templating/sandbox/vendored/pkg/` — **not** the app's own `ajv`/`uuid` dependency (which
    exists separately, for the app's own use, and may be on a newer version) — so the sandbox's
    vetted version is independently reviewable and can never silently drift with a routine app
    dependency bump. Invariant: the sandbox's pin must never exceed the app's own resolved version
    for the same library (the sandbox may lag the app, never lead it) — enforced by
    `npm run sandbox:vendored:guardrail -w insomnia` (also run in CI).
    New libs are added deliberately via `scripts/generate-sandbox-vendored.ts` (see its checklist);
    to bump an already-vetted lib's version, prefer
    `npm run sandbox:vendored:upgrade -w insomnia -- <lib>@<version>` over hand-editing
    `vendored/pkg/package.json` — it verifies the requested version is exactly what got installed and
    exactly what ended up in the regenerated bundle, checks the guardrail above, and runs that lib's
    `<name>.regression.test.ts` suite before you commit.
- `require('X')` where `X` isn't granted → **`Module 'X' not permitted by manifest`**.
- `require('X')` where `X` is granted but Insomnia doesn't ship it → **`Module 'X' not available in
sandbox`** (ask for it to be added to the registry).

## Axis 2 — `capabilities`

Host-side actions your tag may perform through `context.*`. A capability you don't hold means that
branch of `context` is simply **absent** (`context.network === undefined`), so you can feature-detect
and degrade gracefully.

| Capability    | Grants                                        | Baseline?    |
| ------------- | --------------------------------------------- | ------------ |
| `render`      | `context.util.render`                         | ✅           |
| `models.read` | read-only `context.util.models.*` lookups     | ✅           |
| `util`        | `context.util.nodeOS` / `decode` / `encode`   | ✅           |
| `crypto`      | `require('crypto')` host functions            | ✅           |
| `network`     | `context.network.*`                           | — declare it |
| `storage`     | `context.store.*`                             | — declare it |
| `fs-read`     | `context.util.readFile`                       | — declare it |
| `app`         | `context.app.*`, `context.util.openInBrowser` | — declare it |

`credentials` (cloud-provider credential read/write) is **reserved for first-party bundle plugins**
and cannot be granted to a community template-tag plugin, even if declared — it is above the
template-tag surface's ceiling.

## Migration

A plugin that declares **no** `permissions` block runs on the baseline grant. If it then reaches for
a non-baseline module you'll see a one-time notification naming the exact grant to add. Add the
`insomnia.permissions` block above and reload the plugin.

## Multi-file plugins

A plugin can be split across files: `require('./util')`, `require('../shared')`, and
`require('./lib')` (→ `./lib/index.js`) all resolve from the plugin's own source, read from within
the plugin directory. The plugin's **own `node_modules` is never consulted** — a bare
`require('uuid')` always resolves to the vetted registry copy, so a plugin can't ship a substitute
implementation of a granted module. Only `.js`/`.json` files inside the plugin directory are
loaded (`node_modules` and dot-directories are skipped).

> **`require` a vetted lib inside `run()`, not at top level.** Insomnia still discovers a plugin's
> tags by loading its entry in the host process, so a **top-level** `require('uuid')`/`require('ajv')`
> fails to resolve there (those live only in the sandbox registry, not on disk next to the plugin).
> Require them from inside the tag's `run()` — they resolve when the tag executes in the sandbox.
> Relative requires (`./util`) are fine at top level.

## Notes

- Bundle (first-party) plugins are trusted and receive all modules + capabilities.
- Malformed `permissions` (e.g. a non-array `modules`) degrade to baseline with a warning on the
  plugin's card in Preferences → Plugins — the plugin still loads.
