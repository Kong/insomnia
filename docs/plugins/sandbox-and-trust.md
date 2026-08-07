<!-- DRAFT (P1-A). Source of truth: packages/insomnia/src/common/plugins/sandbox-mode.ts -->

# Sandbox & trust model (draft)

## How plugin code runs

Insomnia can run an installed (user) plugin's code in one of two places:

- **In-process** — directly in the app's main/renderer process, with full Node.js access
  (`fs`, `child_process`, arbitrary `require`, etc.). This is the legacy behaviour.
- **In the QuickJS sandbox** — an isolated JS runtime with no direct Node access. The plugin reaches
  the host only through a **capability-gated bridge**, and `require()` resolves only from a curated
  module registry. See [Permissions](./permissions.md).

Which one is used depends on a global setting and a per-plugin opt-in.

## The setting: `pluginSandboxEnabled`

Preferences → Scripting → **"Sandbox all plugin code"**. When on, every *untrusted* (user) plugin
surface — template tags, request/response hooks, actions, and load-time code — runs in the sandbox.

It supersedes the older experiment **`templateTagSandboxEnabled`** ("Run template tags in sandbox").
For migration, **either** flag being on activates the sandbox, so if you already opted into the
template-tag experiment nothing changes for you. New guidance should refer only to
`pluginSandboxEnabled`.

## Execution modes

For a given plugin, the resolved mode is one of (see `resolvePluginExecutionMode`):

| Mode | When | Runs | Host access |
|---|---|---|---|
| **Trusted** | first-party bundle plugin (ships with Insomnia) | in-process | full (by design) |
| **Sandboxed** | user plugin, sandbox on, not elevated | QuickJS sandbox | only declared capabilities |
| **Elevated** | user plugin, sandbox on, you turned on "Full host access" | in-process | full |
| **In-process** | user plugin, sandbox off | in-process | full (legacy) |

Preferences → Plugins shows each plugin's mode as a badge.

## The escape hatch: "Full host access" (elevated)

Some community plugins genuinely need native modules or host access the sandbox doesn't grant. For
those, Preferences → Plugins has a per-plugin **"Full host access"** toggle. It's:

- **off by default** — a plugin is sandboxed unless you deliberately elevate it;
- **per-plugin** — never global;
- a **trust decision** — an elevated plugin runs in-process with full Node access, exactly like the
  pre-sandbox world. Only elevate plugins you trust.

## Migration guide (for plugin authors)

If your plugin worked before the sandbox and breaks with it on:

1. **Do you `require()` `fs` / `child_process` / an arbitrary npm package?** Those aren't reachable in
   the sandbox. Move to a registry module (see [Permissions](./permissions.md)) and declare it, or ask
   the user to enable "Full host access" for your plugin.
2. **Do you call `context.network` / read files / use storage / credentials?** Declare the matching
   capability in `insomnia.permissions.capabilities`. Undeclared calls fail with an actionable error
   naming the missing capability.
3. **Multi-file plugin?** Your own `node_modules` is **not** consulted at runtime — third-party deps
   must be registry modules, declared in `permissions.modules`.

## Caveats

- **The `inso` CLI has no sandbox host.** Under the pure-Node CLI, user-plugin hooks run in-process
  regardless of the setting — CLI users are trusting their own plugins.
- **Bundle template tags** run in the sandbox only under the legacy `templateTagSandboxEnabled`
  experiment (a hardening opt-in); the `pluginSandboxEnabled` flip leaves trusted bundle plugins
  in-process.
