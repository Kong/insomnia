<!--
DRAFT (P1-A docs). Iterating in-repo before porting to developer.konghq.com.
These pages document the plugin sandbox / trust model introduced across the L1/H1/A1/T1/S1 work
and the #10295 load-failure fix. Verify anything marked TODO against source before publishing.
-->

# Insomnia plugin sandbox & trust — authoring guide (draft)

This folder is a working draft of the plugin-authoring docs for the sandboxed plugin model. It's
here so we can iterate on the content in review; the published home is developer.konghq.com.

## Pages

- **[Sandbox & trust model](./sandbox-and-trust.md)** — how plugin code runs (in-process vs the
  QuickJS sandbox), the `pluginSandboxEnabled` setting, the per-plugin "Full host access" (elevated)
  opt-in, and the migration from the older `templateTagSandboxEnabled` experiment.
- **[Permissions (`insomnia.permissions`)](./permissions.md)** — declaring the modules and host
  capabilities a plugin needs, the default-deny baseline, and the capability reference.
- **[Troubleshooting](./troubleshooting.md)** — "my plugin disappeared", disabled rows with a
  reason, and current known limitations.

## What changed (hardening vs. regression)

The sandbox work is a deliberate security hardening, not a set of regressions. Distinguishing the two:

| Change | Kind | Author-visible effect |
|---|---|---|
| User plugins run in the QuickJS sandbox when the sandbox is on | hardening | plugin code no longer has raw Node/`fs`/`child_process`; reaches the host only through declared capabilities |
| `require()` resolves only from a curated registry | hardening | arbitrary npm/`node_modules` requires fail unless the module is in the registry **and** declared |
| Default-deny permissions (baseline only unless declared) | hardening | a plugin that used network/fs/credentials without declaring them must add an `insomnia.permissions` block |
| Plugin load failures show as a disabled row with a reason (#10295) | **regression fix** | a plugin that fails to load (or whose name collides) no longer silently vanishes |
| Bundle (first-party) plugins stay in-process | unchanged | n/a |

> Release-notes wording (TODO): lead with the #10295 regression fix (visible, user-facing win), then
> summarize the hardening as "plugins are now sandboxed by default when the setting is on; declare
> what you need in `insomnia.permissions`" with a link to [permissions](./permissions.md).
