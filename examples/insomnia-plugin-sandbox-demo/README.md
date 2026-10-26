# insomnia-plugin-sandbox-demo

Manual test fixture for the QuickJS template-tag sandbox (Milestone 2).

The `sandboxprobe` tag reports **where** it executed and exercises an async host bridge:

- Sandbox flag **off** → `hello | ran in: main-process | arch via bridge: <arch>`
- Sandbox flag **on** → `hello | ran in: sandbox | arch via bridge: <arch>`

`ran in` flips because the sandbox defines the `INSOMNIA_TEMPLATE_SANDBOX` marker global, which the
legacy main-process path lacks. (`process` used to be the signal, but since M2 the sandbox provides
a `process` stub too, so a dedicated marker is used instead.) `arch via bridge` proves
`context.util.nodeOS()` round-tripped through `__hostBridge` → `pluginToMainAPI['nodeOS']` and back.

## Install (dev)

1. Run the app: `npm run dev` (repo root).
2. Preferences → Plugins → **Reveal Plugins Folder**.
3. Copy this `insomnia-plugin-sandbox-demo` folder into that directory.
4. Click **Reload Plugins**.
5. Preferences → Scripting → toggle **Run template tags in sandbox (experimental)**.
6. In a request URL/header, insert the `Sandbox Probe` template tag (or type `{% sandboxprobe 'hi' %}`),
   and watch the preview change as you toggle the flag.

The `requireprobe` tag demos the manifest-gated module registry (M1): `{% requireprobe 'path' %}`
renders `a/b` (baseline grant, curated registry implementation), while `{% requireprobe 'fs' %}`
or any npm package fails with `Module 'X' not permitted by manifest`. A granted-but-unshipped
module would fail with `Module 'X' not available in sandbox`. Registry coverage grows in M2/M3;
relative files (`require('./util')`) arrive with plugin pre-bundling (M4).

The `eventsprobe` tag demos a **manifest-declared grant** (C3): this plugin's `package.json`
declares `insomnia.permissions.modules: ["events"]`, so `{% eventsprobe %}` renders `events-ok`.
A plugin that did not declare `events` would get `Module 'events' not permitted by manifest`.
Preferences → Plugins shows each plugin's declared permissions (this one lists `modules: events`).

The `stdlibprobe` tag demos the **ambient sandbox globals** (M2) — `Buffer`, `URL`/`URLSearchParams`,
a frozen `process` stub, and Web-Crypto `crypto.getRandomValues`/`crypto.subtle`. These are always
present (not manifest-gated) as pure-JS or host-backed safe equivalents, and render identically to
the legacy main-process path: `{% stdlibprobe 'buffer' %}`, `{% stdlibprobe 'url' %}`,
`{% stdlibprobe 'platform' %}`.

The `capabilityprobe` tag demos **manifest-gated host capabilities** (C1): this plugin declares
`insomnia.permissions.capabilities: ["storage"]`, so `{% capabilityprobe %}` completes a `context.store`
set/get round-trip and renders `storage-ok`. A plugin that did not declare `storage` would get
`Capability 'storage' not granted — add it to insomnia.permissions.capabilities`. Baseline
capabilities (`render`, `models.read`, `util`, `crypto`) need no declaration; network / storage /
fs-read / app do. `credentials` is reserved for first-party bundle plugins and can't be granted to a
community plugin even if declared (it's above the template-tag surface's ceiling — see
[PERMISSIONS.md](../../packages/insomnia/src/templating/sandbox/PERMISSIONS.md)). A plugin that
declares no manifest and reaches for a non-baseline module gets a one-time migration notification
naming the grant to add.
