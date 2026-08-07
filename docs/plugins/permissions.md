<!--
DRAFT (P1-A). Sources of truth:
- capabilities: packages/insomnia/src/templating/sandbox/host-bridge.ts (BRIDGE_PATH_CAPABILITIES, Capability)
- modules: packages/insomnia/src/templating/sandbox/module-registry.ts (ALL_SANDBOX_MODULES / SANDBOX_MODULES)
- baseline: TEMPLATE_TAG_BASELINE_MODULES / TEMPLATE_TAG_BASELINE_CAPABILITIES
The module list below is illustrative — generate the canonical list from ALL_SANDBOX_MODULES before publishing.
-->

# Plugin permissions (`insomnia.permissions`) — draft

When a plugin runs sandboxed, it is **default-deny** on two axes: which modules it can `require()`,
and which host capabilities it can call. You declare what your plugin needs in its `package.json`
under the `insomnia.permissions` key.

```jsonc
{
  "name": "insomnia-plugin-example",
  "insomnia": {
    "permissions": {
      "modules": ["crypto", "ajv"],        // require() allow-list (registry names)
      "capabilities": ["network", "storage"] // host APIs the plugin may reach
    }
  }
}
```

A plugin with **no** `permissions` block gets the baseline only (see below). Requesting anything
beyond the baseline requires declaring it, or the call fails with an actionable error such as:

> `capability 'network' not granted — add it to insomnia.permissions.capabilities`

## Baseline (no manifest)

| Axis | Baseline grant |
|---|---|
| Modules | `path`, `crypto` |
| Capabilities | `render`, `models.read`, `util`, `crypto` |

Anything network-, filesystem-, credential-, storage-, or app/UI-related must be declared explicitly.

## Capabilities reference

Declarable values for `insomnia.permissions.capabilities`:

| Capability | Grants |
|---|---|
| `render` | nested template rendering (`context.util.render`) |
| `models.read` | read requests, workspaces, cookie jars, responses, settings, OAuth2 tokens |
| `util` | encode/decode + host OS info helpers |
| `crypto` | the host-backed `crypto` module (hash/hmac/random) |
| `network` | outbound HTTP via `context.network.sendRequest*` |
| `storage` | plugin-scoped key/value store (`context.store`) |
| `fs-read` | allow-listed file reads |
| `credentials` | read/update stored cloud credentials |
| `app` | dialogs, prompts, clipboard, open-in-browser |

> Note: `models.read` includes reading **OAuth2 tokens**, which are live bearer credentials. It's part
> of the baseline; treat it as a credential-disclosure surface when reasoning about what a manifest-less
> plugin can see. (TODO: decide whether token reads should move behind `credentials` in a future rev.)

## Modules reference (`require()` allow-list)

Inside the sandbox, `require(name)` resolves **only** from Insomnia's curated registry — never your
plugin's `node_modules` and never raw Node built-ins. Declaring a module in `permissions.modules` is
what unlocks it; the registry is what makes a safe implementation available.

Categories (representative — **canonical list is `ALL_SANDBOX_MODULES`**):

- **Baseline:** `path`, `crypto`
- **Polyfilled built-ins:** e.g. `events` (and others — verify against the registry)
- **Vetted libraries:** e.g. `ajv`, `uuid` (and others — verify against the registry)

Two distinct failure messages tell you which problem you have:

- `Module 'X' not permitted by manifest` — the module exists in the registry but you didn't declare it.
- `Module 'X' not available in sandbox` — you declared it, but it isn't in the registry.

> TODO(before publish): replace the "representative" module list with the generated `ALL_SANDBOX_MODULES`
> set, ideally via a docs-gen step so it can't drift.
