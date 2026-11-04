# Decisions

Why things are the way they are.

| Decision | Why |
|---|---|
| Forked Insomnia, not the old Insomnium | The old fork was years behind, and Insomnia is Apache-2.0 |
| Named Restless | Not close to Kong's Insomnia mark, and it contains "REST" |
| CLI command is `rl` | Short. The npm package is `restless-cli` |
| Internal folders stay `insomnia` | A rename would conflict with every merge from Insomnia |
| Keep `collection.insomnia.rest/5.0` | It's a format ID, and changing it breaks compatibility |
| Accept `insomnia://` links for plugins, themes and imports only | Keeps the plugin ecosystem working, without exposing other link actions |
| Loopback OAuth redirect | No relay server sees your authorization code |
| GitHub device flow | Needs no client secret |
| Keep Electron 45 | Staying current matters more than the square Chromium window buttons, which Electron 43 drew on KDE |
| Native window controls on Linux | They match the desktop. The app sets the theme early and dims them with dialogs |
| Bundled fonts | Nothing downloads at runtime |

## Open questions

- Native file format: `.bru`, Bruno's YAML, or both. YAML is the likely default, with `.bru` for import and export.
- Store history, cookies and tokens in the app, or on disk too.
- Keep Nunjucks, add Bruno's `{{var}}` rules, or support both per collection.
