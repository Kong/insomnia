<!-- DRAFT (P1-A). Covers the #10295 fix behaviour + current known limitations. -->

# Plugin troubleshooting (draft)

## "My plugin disappeared from the list"

As of the #10295 fix, a plugin that fails to load **no longer silently vanishes**. Instead it appears
in Preferences → Plugins as a **disabled row with a reason**:

- Open Preferences → **Plugins** and look for a row marked **"Failed to load plugin"** (warning icon,
  no enable checkbox). Expand it to see the exact error.

Common reasons and fixes:

| Reason shown | Cause | Fix |
|---|---|---|
| `Cannot find module '…'` | a `require()` failed (missing dep, or a module not in the sandbox registry) | add the dep as a registry module in `permissions.modules`, or fix the missing dependency; see [Permissions](./permissions.md) |
| `Multiple plugin folders declare the name "…"` | two folders under your plugin paths declare the same plugin `name` | remove/rename the duplicate folder — while a name is claimed by more than one folder, **none** of them load (this is deliberate, to avoid an ambiguous trust grant) |
| other load-time error | the plugin's top-level code threw | see the message; if it needs host access the sandbox doesn't grant, consider "Full host access" (see [Sandbox & trust](./sandbox-and-trust.md)) |

### A plugin stayed broken even after I fixed the error

Older versions cached the plugin/render engine for the whole session, so a plugin that failed once
stayed broken until restart. This is fixed: use Preferences → Plugins → **Reload plugins** (or the
`plugin_reload` shortcut) — reload now rebuilds the render engine and re-scans the registry, so a
plugin recovers once its underlying error is fixed. No reinstall-into-a-fresh-folder needed.

## Known limitations

### Passing DOM / non-serializable values across the plugin boundary

APIs that pass rich objects (e.g. `context.app.dialog()` with DOM nodes) don't round-trip through the
sandbox bridge, which marshals plain JSON. Prefer serializable data.

### Folder actions (`requestGroupActions`) — see #10292

`requestGroupActions` (folder-level actions) are reported broken in
[#10292](https://github.com/Kong/insomnia/issues/10292).

> TODO(triage): confirm whether this is a sandbox/marshalling limitation to document here, or an A1
> action-routing regression to fix. If it's a regression, this belongs in a fix PR, not the
> known-limitations list. **Do not finalize this section until #10292 is triaged.**

## Still stuck?

File an issue at https://github.com/Kong/insomnia/issues with the exact text from the plugin's
disabled-row reason and your `package.json` `insomnia` block.
