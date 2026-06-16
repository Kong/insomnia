# insomnia-plugin-sandbox-demo

Manual test fixture for the QuickJS template-tag sandbox (Milestone 2).

The `sandboxprobe` tag reports **where** it executed and exercises an async host bridge:

- Sandbox flag **off** → `hello | ran in: main-process | arch via bridge: <arch>`
- Sandbox flag **on**  → `hello | ran in: sandbox | arch via bridge: <arch>`

`ran in` flips because Node's `process` global exists in the legacy main-process path but is
absent inside QuickJS. `arch via bridge` proves `context.util.nodeOS()` round-tripped through
`__hostBridge` → `pluginToMainAPI['nodeOS']` and back.

## Install (dev)

1. Run the app: `npm run dev` (repo root).
2. Preferences → Plugins → **Reveal Plugins Folder**.
3. Copy this `insomnia-plugin-sandbox-demo` folder into that directory.
4. Click **Reload Plugins**.
5. Preferences → Scripting → toggle **Run template tags in sandbox (experimental)**.
6. In a request URL/header, insert the `Sandbox Probe` template tag (or type `{% sandboxprobe 'hi' %}`),
   and watch the preview change as you toggle the flag.

Note: this M2 cut's `require` shim only supports `path`. A plugin that `require()`s `crypto`,
an npm package, or a relative file will throw a clear `Cannot find module ... in sandbox` — that
broader compatibility is Milestone 3.
