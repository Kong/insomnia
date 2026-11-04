# Roadmap

Goal: every Insomnia and Bruno feature in one app, local-first, with no account, telemetry or vendor service.

## Rules

- No login, no cloud dependency, no feature gates. A feature needing a remote service must let the user bring their own.
- Network calls happen only when the user sends a request, syncs Git, or checks for updates.
- Files are the source of truth. Git works with plain tools, outside the app.
- Bruno is MIT: port code with its copyright notice. Do not use its logo or name.
- Kong code is Apache-2.0: keep notices and mark changed files. Check the license of each commit taken.
- Paid Bruno features are not in its repo. Build those from scratch.

## Baseline

Bruno refs are from `usebruno/bruno` at `72f2e3043`.

Both have: REST, GraphQL, gRPC, WebSocket, SSE, collection runner, Git, local mock server, Postman, OpenAPI, Insomnia and WSDL import, code generation, themes, keybindings, CLI, client certs, proxy, cookies, OAuth 1 and 2, Digest, NTLM, AWS, Bearer, Basic, API key.

Only here: Socket.IO, MCP client, OpenAPI design editor with Spectral lint, unit test suites, Nunjucks template tags, plugins, full Git UI, Hawk, Netrc, ASAP.

Only Bruno: see phases 2 to 6.

## Phase 0: Finish the fork

- [ ] Fix the 5 failing smoke tests
- [ ] Verify title bar, menus and shortcuts on Linux, Windows and macOS
- [ ] Release CI: build, sign, publish to GitHub releases, test the updater
- [ ] Remove the Squirrel target; NSIS only on Windows
- [ ] Fix the remaining audit findings
- [ ] Rewrite README, CONTRIBUTING and SECURITY for this project
- [ ] Add Apache notices for changed files
- [ ] Remove Kong docs links, dead cloud branches and no-op telemetry calls
- [ ] Rename the `insomnia://` scheme and hide the cloud mock option
- [ ] Import data from an existing Insomnia or Bruno install

## Phase 1: Restore what the rip removed

- [ ] OAuth default-browser flow on a local loopback redirect, replacing `app.insomnia.rest`
- [ ] GitHub and GitLab sign-in with device flow or user-supplied OAuth apps
- [ ] gRPC reflection on URLs with a path prefix
- [ ] Bring-your-own-key AI: OpenAI, Anthropic, OpenAI-compatible and local models
- [ ] External secret managers: HashiCorp Vault, AWS, Azure, GCP

## Phase 2: Files as the source of truth

Largest change here. Do it first, since later features build on the storage model.

- [ ] Store collections as readable files in a user-chosen folder, one file per request
- [ ] Read and write `.bru` and Bruno's YAML format, using `bruno-lang` and `bruno-filestore`
- [ ] Watch the folder and reload on external edits
- [ ] Open any folder as a collection
- [ ] Workspaces that group collections and environments on disk
- [ ] Migration from the NeDB store, with a backup
- [ ] `.env` file support and editor
- [ ] Single-file YAML and ZIP collection export

## Phase 3: Daily workflow

- [ ] Global search across collections, requests and URLs
- [ ] Transient requests, savable later
- [ ] Preview tabs and pinned tabs
- [ ] Autosave setting
- [ ] Restore open tabs and sidebar state per collection
- [ ] Bulk edit for headers, params and form fields
- [ ] Set a variable from a response value in one click
- [ ] Inherited auth and settings at collection and folder level
- [ ] Request presets per collection
- [ ] Prompted variables
- [ ] Environment color badges
- [ ] Unresolved variable warnings
- [ ] Response layout toggle and large response protection
- [ ] Saved response examples, usable in docs and mocks
- [ ] Collection and folder docs as Markdown
- [ ] Visual diff for request changes

## Phase 4: Testing

- [ ] No-code assertions on requests
- [ ] No-code pre and post request variables
- [ ] Tags on requests, include and exclude in runner and CLI
- [ ] Runner results persisted in SQLite
- [ ] CLI: JUnit and HTML reports, env files, tag filters, per-field report redaction
- [ ] Node VM and QuickJS sandbox choice, shared by app and CLI
- [ ] Translate Bruno and Postman scripts on import, with a report of what did not convert
- [ ] Performance and load testing

## Phase 5: Protocols and auth

- [ ] WSSE and Akamai EdgeGrid auth
- [ ] Protobuf import paths per collection
- [ ] gRPC scripts
- [ ] WebSocket scripts and per-connection settings
- [ ] GraphQL query builder
- [ ] Hawk, Netrc, ASAP and template tags kept working through the Bruno format

## Phase 6: API lifecycle

- [ ] Connect a collection to an OpenAPI spec and sync changes both ways
- [ ] Spec panel inside a collection
- [ ] Local mock server dashboard: create, clone, search, serve from saved examples
- [ ] Export to Postman, OpenAPI and Bruno
- [ ] Bulk import of many collections

## Phase 7: Developer tools and AI

- [ ] Built-in terminal
- [ ] Devtools panel: console, network, performance
- [ ] AI chat sidebar, inline assist and autocomplete
- [ ] AI generation for tests and scripts
- [ ] Runnable collection apps

## Phase 8: UI

- [ ] Replace leftover legacy components with the compact design system
- [ ] Settings as a tab, split by section, searchable
- [ ] Sidebar density and keyboard navigation
- [ ] Command palette covers every action
- [ ] Light theme matching the dark palette
- [ ] Accessibility pass

## Open questions

- Native format: `.bru`, Bruno's YAML, or both. YAML is the likely default.
- Merge app stores or stay on files alone for history, cookies and tokens.
- Keep Nunjucks, add Bruno's `{{var}}` rules, or support both per collection.
