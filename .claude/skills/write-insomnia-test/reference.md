# Reference: Flows, Models, Enums, Mock Servers

This is a ground-truth snapshot of the test framework's API surface, used to avoid inventing methods/fields when writing a spec. If something you need isn't here, read the actual file in `flows/`/`pages/`/`models/` before using it — this file can go stale as the framework grows.

## Domain → flow/page/model map

Every test injects only the `user` fixture (`async ({ user }) => {...}`) — never the per-flow fixtures below directly. Pull what you need out of `user.flowManager` (and `user.pageManager` for direct Page access) at the top of the test body, e.g. `const { workspaceFlow, httpRequestFlow } = user.flowManager;`.

| Domain                                                                                                       | `flowManager` property                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Flow file                                           | Page file                                                                                                                                                                                | Model file                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace (Project/Collection/Environment/McpClient nodes — a Collection may carry an OpenAPI/Swagger spec + legacy unit tests, the former standalone "Document" workspace merged in by INS-3528) | `workspaceFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `flows/workspace.flow.ts`                           | `pages/workspace.page.ts`                                                                                                                                                                | `models/project.ts`, `models/collection.ts`                                                                                                                |
| Command Palette (Cmd/Ctrl+P quick search / jump-to)                                                          | `workspaceFlow` (`search()` — no separate CommandPaletteFlow)                                                                                                                                                                                                                                                                                                                                                                                                                                      | `flows/workspace.flow.ts`                           | `pages/command-palette.page.ts`                                                                                                                                                          | —                                                                                                                                                                                |
| Collection Runner                                                                                            | `workspaceFlow` (`run()`/`openRunner()` — no separate RunnerFlow)                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/workspace.flow.ts`                           | `pages/runner.page.ts`                                                                                                                                                                   | `models/runner.ts`                                                                                                                                                               |
| HTTP request                                                                                                 | `httpRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/http-request.flow.ts`                        | `pages/http-request.page.ts`                                                                                                                                                             | `models/http-request.ts`                                                                                                                                                         |
| GraphQL request                                                                                              | `graphqlRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `flows/graphql-request.flow.ts`                     | `pages/graphql-request.page.ts`                                                                                                                                                          | `models/graphql-request.ts`                                                                                                                                                      |
| gRPC request                                                                                                 | `grpcRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/grpc-request.flow.ts`                        | `pages/grpc-request.page.ts`                                                                                                                                                             | `models/grpc-request.ts`                                                                                                                                                         |
| WebSocket request                                                                                            | `webSocketRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `flows/web-socket-request.flow.ts`                  | `pages/web-socket-request.page.ts`                                                                                                                                                       | `models/websocket-request.ts`                                                                                                                                                    |
| Socket.IO request                                                                                            | `socketIoRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `flows/socket-io-request.flow.ts`                   | `pages/socket-io-request.page.ts`                                                                                                                                                        | `models/socket-io-request.ts`                                                                                                                                                    |
| Event Stream (SSE) request                                                                                   | `eventStreamRequestFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `flows/event-stream-request.flow.ts`                | `pages/event-stream-request.page.ts`                                                                                                                                                     | `models/event-stream-request.ts`                                                                                                                                                 |
| MCP client                                                                                                   | `mcpClientFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `flows/mcp-client.flow.ts`                          | `pages/mcp-client.page.ts`                                                                                                                                                               | `models/mcp-client.ts`                                                                                                                                                           |
| Environment                                                                                                  | `environmentFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/environment.flow.ts`                         | `pages/environment.page.ts`                                                                                                                                                              | `models/environment.ts`                                                                                                                                                          |
| Cookie                                                                                                       | `cookieFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `flows/cookie.flow.ts`                              | `pages/cookie.page.ts`                                                                                                                                                                   | `models/cookie.ts`                                                                                                                                                               |
| Certificates (CA + Client, `tests/http-request/`, `tests/grpc-request/`)                                     | `certificatesFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `flows/certificates.flow.ts`                        | `pages/certificates.page.ts`                                                                                                                                                             | `models/certificate.ts`                                                                                                                                                          |
| Folder (a Collection sub-container — creation + its own Auth/Headers/Scripts/Environment/Docs tab)           | `folderFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `flows/folder.flow.ts`                              | `pages/folder.page.ts` (extends the shared `pages/auth-tab.page.ts`, same as `RequestPage`)                                                                                              | `models/folder.ts`                                                                                                                                                               |
| Import                                                                                                       | `importFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `flows/import.flow.ts`                              | `pages/import.page.ts`                                                                                                                                                                   | `models/curl-command.ts` (other sources import raw string/file path)                                                                                                             |
| Export                                                                                                       | `exportFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `flows/export.flow.ts`                              | `pages/export.page.ts`                                                                                                                                                                   | none — takes `Collection`/`Project` + `ExportFormat` (`enums/export-format.ts`)                                                                                                  |
| Response (read-only, returned by `send`/`connect`)                                                           | — (via `user.pageManager.responsePage`)                                                                                                                                                                                                                                                                                                                                                                                                                                                            | —                                                   | `pages/response.page.ts`                                                                                                                                                                 | `models/response.ts`                                                                                                                                                             |
| Preferences (app-wide Settings, not a domain entity)                                                         | `preferencesFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/preferences.flow.ts`                         | `pages/preferences.page.ts`                                                                                                                                                              | `models/settings.ts` (simple fields only; complex ones out of scope — `filterResponsesByEnv`/`timeout`/`proxyEnabled`/`httpProxy`/`httpsProxy`/`noProxy`/`sidebarFocusForCollections` (defaults `false` in the `user` fixture, see below) all wired into `set()`) |
| AI Settings — "url" backend (Preferences → AI Settings tab, `tests/preferences/ai-backend-settings.spec.ts`) | `preferencesFlow` (`set({ aiUrlBackend })` — configured/deactivated entirely through the real UI form, no bridge call)                                                                                                                                                                                                                                                                                                                                                                             | `flows/preferences.flow.ts`                         | `pages/preferences.page.ts`                                                                                                                                                              | `models/settings.ts`'s `AiUrlBackendSettings` (synthetic `Settings` field, not a real `AppSettings` member)                                                                      |
| Cloud (Vault) Credentials (Preferences → Credentials tab's "Create Cloud Credential" — AWS/GCP/HashiCorp auth for the `vault` template tag, `tests/template-tag/external-vault-credentials.spec.ts`) | `preferencesFlow` (`set({ cloudCredentials })` — no separate CloudCredentialFlow/Page)                                                                                                                                                                                                                                                                                                                                                                                                             | `flows/preferences.flow.ts`                         | `pages/preferences.page.ts`                                                                                                                                                              | `models/settings.ts`'s `CloudCredential` (reuses `insomnia-data`'s own per-provider `credentials` shapes, narrowed to the one auth mode each has a create method for)            |
| Vault Key (Preferences → General tab's Security section — generate/unlock/reset the local key that gates Secret-typed environment variables, `tests/preferences/vault-key-*.spec.ts`)                | `preferencesFlow` (`generateVaultKey()`/`enterVaultKey()`/`resetVaultKey()` — no separate VaultKeyFlow/Page)                                                                                                                                                                                                                                                                                                                                                                                       | `flows/preferences.flow.ts`                         | `pages/preferences.page.ts`                                                                                                                                                              | none — plain strings in/out; seed via `misc/fixtures.ts`'s `vaultKey`/`vaultSalt` fixture overrides, see the "Vault Key" section under `preferencesFlow` below                          |
| Plugins & Script Sandbox (Preferences → Plugins/Scripting tabs, `tests/plugin/`)                             | `preferencesFlow` (no separate PluginsFlow/PluginsPage)                                                                                                                                                                                                                                                                                                                                                                                                                                            | `flows/preferences.flow.ts`                         | `pages/preferences.page.ts`                                                                                                                                                              | `models/settings.ts`'s `templateTagSandboxEnabled`; `enums/script-sandbox-rule-group.ts`                                                                                         |
| Konnect sidebar sync (`tests/konnect/`)                                                                      | none — call `user.pageManager.konnectPage` directly, no KonnectFlow                                                                                                                                                                                                                                                                                                                                                                                                                                | none                                                | `pages/konnect.page.ts`                                                                                                                                                                  | none                                                                                                                                                                             |
| Template Tags (Insert/Edit Tag modal, Live Preview)                                                          | `templateTagFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `flows/template-tag.flow.ts`                        | `pages/template-tag.page.ts`                                                                                                                                                             | `models/template-tag.ts`                                                                                                                                                         |
| Git Sync (branch/commit/history/push, `tests/git-sync/`)                                                     | `gitSyncFlow` (+ `preferencesFlow.addGitCredential`, `workspaceFlow.create`/`.openSettings` for cloning/settings/adopting a local folder)                                                                                                                                                                                                                                                                                                                                                          | `flows/git-sync.flow.ts`, `flows/workspace.flow.ts` | `pages/git-sync.page.ts` (connected-project toolbar/modals), `pages/project-settings.page.ts` (create/settings dialog's Git setup form + repo relocation + "Open local folder" sub-form) | `models/commit.ts`, `models/git-credential.ts`, `models/git-repo-connection.ts`                                                                                                  |
| Cloud Sync (VCS-backed workspace sync, `tests/cloud-sync/`)                                                  | `cloudSyncFlow` (fetch/discardAllChanges/commitAndPush/restoreSnapshot/createBranch/mergeBranch/delete) — Branches-modal actions (fetch remote branch/checkout/delete/create) and a few polling/re-navigation/one-off-action helpers (`reselect`/`waitForPullAvailable`/`clickPull`/`closeSyncMenu`/`isCommitDisabled`) have no Flow wrapper, call `pageManager.cloudSyncPage` directly since a whole modal-session needs to stay open across several of them or the test needs to read a live value rather than fire-and-forget an action | `flows/cloud-sync.flow.ts`                          | `pages/cloud-sync.page.ts`                                                                                                                                                               | `enums/delete-mode.ts` (`DeleteMode`), `enums/sync-status.ts` (`SyncStatus`) — otherwise plain strings/booleans in, plain booleans out                                           |
| App lifecycle (main process, not a UI domain)                                                                | `appFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `flows/app.flow.ts`                                 | none — reaches the main process directly via `flowManager.electronApp`, no DOM involved                                                                                                  | none                                                                                                                                                                             |
| Login / Scratch Pad entry points (`tests/app/scratch-pad-mode.spec.ts`)                                      | none — call `user.pageManager.workspacePage` directly (`logOut()`/`clickUseLocalScratchPad()`/`isLoginEntryPointVisible()`/`isUnlockFullFeaturesVisible()`), no dedicated flow                                                                                                                                                                                                                                                                                                                     | none                                                | `pages/workspace.page.ts`                                                                                                                                                                | none                                                                                                                                                                             |
| Organization / Invite collaborators (header's "Invite collaborators" dialog, `tests/organization/`)          | `organizationFlow`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `flows/organization.flow.ts`                        | `pages/invite.page.ts`                                                                                                                                                                   | none — `Collaborator` type lives inline in `flows/organization.flow.ts`; `enums/collaborator-role.ts` (`CollaboratorRole`)                                                       |
| Data-directory migration screens (git-repo filesystem migration, `tests/migration/`)                         | none — inject `window` directly (not `user`) and drive raw locators; seed via `test.extend`'ing `misc/fixtures.ts`'s `dataPath`/`skipOnboarding` fixtures, see "Pre-seeding a data directory before launch" below                                                                                                                                                                                                                                                                                 | none                                                | none — no page-object layer, matches insomnia-smoke-test's own migration specs                                                                                                          | none                                                                                                                                                                             |
| Legacy NeDB migration (v7→v8 on-launch upgrade, `tests/migration/legacy-db-migration/`)                      | plain `user` fixture works here (unlike the git-repo row above); seed via `test.extend`'ing `dataPath`, see "Pre-seeding a data directory before launch" below                                                                                                                                                                                                                                                                                                                                     | none                                                | none                                                                                                                                                                                      | none                                                                                                                                                                             |

**Git Sync tests import `test`/`expect`/`DEFAULT_TIMEOUT` from `../../misc/git-fixtures`, not `../../misc/fixtures`** — that module wraps the base `user` fixture to also inject a running local git mock server (`misc/git-server.js`) and its verification helpers. See the "`gitSyncFlow`" section below.

`user.pageManager` is always available for one-off Page access — destructure the exact Page(s) you need from it at the top of the test, the same way as `flowManager` (`const { workspacePage } = user.pageManager;`, then call `workspacePage.getNodes()`), never keep `pageManager` itself around and reach through it inline (`pageManager.workspacePage.getNodes()`) or destructure it whole (`const { pageManager } = user;`). There is no generic dialog reader — a dialog popped by an action expected to fail surfaces by rejecting that action's own call; see "`@throwOnDialog`" below.

**Convention: prefer a plain object literal over `new <Model>(...)` whenever the Model's constructor just takes a single init object** (e.g. `Settings`, `Environment`, `HttpRequest`/`GraphQLRequest`/etc.) — `{ validateSSL: false }`, not `new Settings({ validateSSL: false })`. TypeScript's excess-property checking on object literals passed directly to a typed parameter already catches typo'd/nonexistent fields, so the class wrapper adds nothing; add `satisfies <Model>` if you want the check to survive being assigned to a variable first (see `tests/environment/sub-environment-variable-priority.spec.ts:61`). Only reach for `new <Model>(...)` when the constructor takes positional args instead of an init object — `Project`, `Collection`, `Document`, `McpClient` (e.g. `new Project(name, ProjectType)`).

**Convention: a spec calls a Flow method over the equivalent Page method whenever one exists** — `pageManager.xxxPage` is for the one specific action `reference.md` shows has no Flow wrapper (e.g. `<domain>RequestPage.setMethod()`, since no Flow method changes an already-created request's method), not a substitute for a step a Flow method already covers. See SKILL.md's "Prefer Flow methods over direct Page access".

**Convention: Models never cross into a Page method, except `get()`.** Every `<X>Page` exposes only plain per-field setters (`setUrl`, `setMethod`, `setHeaders`, `setBody`, `setValidateSSL`, …) — never a `set(model)` that takes a whole Model and dispatches internally. The owning `<X>Flow`'s `create()`/`set()` is what holds the Model; it reads whichever fields are defined/non-empty and calls the matching Page setter itself (e.g. `HttpRequestFlow.applyRequestFields()`, `EnvironmentFlow.applyVariables()`, `PreferencesFlow.set()`). This keeps the field-by-field dispatch logic (what's optional, what's conditional on what) in the Flow layer, where the Model lives — Pages stay dumb DOM-interaction wrappers with no Model-shaped parameters. `get()` is the one exception: a Page's `get()` returns raw field data, which the Flow then wraps into a Model — that direction is fine, only Model-_in_ is disallowed.

## `workspaceFlow` (the root flow — every domain's parent)

```ts
create(item: Project): Promise<Project>
create(parent: Project, item: Collection | Document | McpClient | Environment): Promise<Collection | Document | McpClient | Environment>

get<T = WorkspaceItem>(item: string | { name: string; id?: string }, parent?: Project | Collection): Promise<T | undefined>
getProject(item) / getCollection(item): Promise<... | undefined>  // the only two with their own public getter; for a Document/Environment/McpClient use the generic get<T>() above instead — getDocument()/getEnvironment()/getMcpClient() are private (internal re-fetch helpers for create()/duplicate()/rename())

duplicate(item: Collection | Document | McpClient | Environment, newName: string, targetProject?: Project): Promise<...>
duplicate(item: HttpRequest | GraphQLRequest | GrpcRequest | EventStreamRequest | SocketIORequest | WebSocketRequest, newName: string): Promise<{ id: string; name: string }>

rename(item: Collection | Document | McpClient | Environment, newName: string): Promise<...>
rename(item: HttpRequest | GraphQLRequest | GrpcRequest | EventStreamRequest | SocketIORequest | WebSocketRequest, newName: string): Promise<{ id: string; name: string }>
// Project is deliberately NOT accepted by rename()/duplicate() — its context menu has neither "Rename" nor "Duplicate" (confirmed live), only "Delete".
// duplicate() on an Environment returns it with `containerName` already populated to `newName` — don't set
// `containerName: <newName>` yourself on the result before passing it to environmentFlow.link()/activate()
// like older specs did. Confirmed live: duplicating only renames the copy's project-tree title, not its
// inner Base Environment document (which still carries the source's original name), so duplicate() now also
// renames that inner document to match — mirroring create()'s own Base-Environment-rename step — before
// returning.

delete(item: Project | Collection | Document | McpClient | Environment | <any request type>): Promise<void>

openSettings(project: Project): Promise<void>
  // right-clicks project's node -> context menu "Settings" -> waits for pageManager.projectSettingsPage.navigate()
  // to confirm the "Create or update dialog" loaded in settings mode. Leaves the dialog open for further
  // pageManager.projectSettingsPage interaction (e.g. relocating a Git Sync project's repo — see gitSyncFlow below).

renameProject(project: Project, newName: string): Promise<Project>
  // Project has no "Rename" context-menu item (see above) — this is the only way to rename one. Calls
  // openSettings() internally, fills projectSettingsPage's "Project name" field, clicks "Update" (which
  // closes the dialog itself — don't call projectSettingsPage.close() afterward), and returns a new
  // Project with the new name (id carried over).

generateCode(request: HttpRequest | GraphQLRequest | EventStreamRequest | SocketIORequest | WebSocketRequest, options?: { target?: string; client?: string }): Promise<string>
  // right-clicks request's node -> context menu ContextMenuItem.GenerateCode -> optionally switches the
  // dialog's target language / client library dropdowns (options.target/.client, exact menu-item labels
  // like "Node.js"/"Axios") -> reads back the code snippet from the "Generate Client Code" dialog (curl/
  // Shell by default when options is omitted) -> clicks "Done". Not available for GrpcRequest (the app's
  // own menu omits "Generate Code" for gRPC). Real examples: tests/http-request/generate-code.spec.ts
  // (default snippet), tests/http-request/generate-code-target-client-switch.spec.ts (target/client switch).
```

`WorkspaceItem` is a discriminated union tagged with `kind`: `"project" | "collection" | "document" | "mcpClient" | "http" | "graphql" | "grpc" | "eventStream" | "socketIO" | "webSocket"`.

Models: `new Project(name, ProjectType)`, `new Collection(name)`, `new Document(name, spec?: Specification)` — all take just a `name` (plus `ProjectType` for Project, optional `spec` for Document). `id?` is populated after creation, not passed in.

### Create/update-project dialog — `pageManager.workspacePage` helpers (no Flow wrapper)

```ts
clickNewProject(): Promise<void>                          // opens the "Create or update dialog" in create mode
setNewProjectType(type: ProjectType): Promise<void>        // selects a type tile; for Git, waits for the credential-setup card or Git Setup Form to appear — use this for the happy path
clickProjectTypeTile(type: ProjectType): Promise<void>     // clicks a type tile WITHOUT waiting for a follow-up form — use when the type is expected to be blocked (see below)
```

The disabled-tile check and the dialog's banner text live on `pageManager.projectSettingsPage` instead (that dialog is the same "Create or update dialog" component `projectSettingsPage` already owns — see below):

```ts
// ProjectSettingsPage (pages/project-settings.page.ts)
projectTypeTile(type: ProjectType): Locator                // the tile's Radio control — pass to BasePage's isDisabled()
getBannerText(label: string): Promise<string | undefined>  // reads a labeled banner inside the dialog, e.g. "Git Sync Feature Disabled Banner" / "Project Storage Restriction Banner"
setName(name: string): Promise<void>                        // fills the "Project name" field — use via workspaceFlow.renameProject(), not directly
clickUpdate(): Promise<void>                                 // clicks "Update"; closes the dialog itself as a side effect (don't call close() after)
```

`navigate()` waits for the "Project name" field to be visible (present in every project type's dialog) — it used to wait for the Git Sync-only "Move repository to another folder" button instead, which meant `openSettings()` hung forever against a Local project; fixed in place, since that's the same call every other project-settings usage (Git relocate, org-flag banners) already depends on.

These exist specifically to test Git Sync being blocked by an org feature flag or storage rule — `misc/fixtures.ts`'s `setGitSyncFeatureFlag(enabled)`/`setGitSyncStorageRule(enabled)` toggle `misc/mock-api.js`'s mutable flags (call from `test.beforeAll()`/`test.afterAll()`, since the storage-rule flag is cached for the whole app session and must be set **before** `electron.launch()`, while the feature flag is refetched on every dialog open so it can be toggled later too — see the real examples below for the safe pre-launch pattern either way). Real examples: `tests/git-sync/disabled-via-feature-flag.spec.ts`, `tests/git-sync/disabled-via-storage-rule.spec.ts`.

### Tab bar (`pageManager.workspacePage` — no `WorkspaceFlow` wrapper)

```ts
addRequestToCurrentCollection(): Promise<void>   // "+" add-tab menu -> "Add request to current collection"; waits for the tab count to grow by 1
clickTab(name: string): Promise<void>            // makes it the active tab
closeTab(name: string): Promise<void>            // clicks the tab's own "x" close button
getActiveTabName(): Promise<string | undefined>
getTabMethodTag(name: string): Promise<string>   // e.g. "GET" — the method tag rendered on the tab itself
getTabNames(): Promise<string[]>                  // on-screen (left-to-right) order
isTabOpen(name: string): Promise<boolean>
pinTab(name: string): Promise<void>               // double-clicks a temporary (italicized preview) tab to pin it
```

`openAddTabMenu()` (opens the "+" menu) is `private` — only `addRequestToCurrentCollection()` calls it internally, so there's no standalone "open the menu without picking anything" scenario to cover from a spec.

**Confirmed live, non-obvious behavior**: navigating to a request via `<x>RequestFlow.get()`/`.create()` opens it as a temporary ("preview") tab that the _next_ navigation reuses/replaces in place — `pinTab()` (a double-click) is what makes a further navigation open a genuinely new tab instead. A tab's label and method tag stay in sync with the underlying request's live data (rename/method-change), and a tab auto-closes when its request is deleted — but asynchronously, so assert with `expect.poll(() => workspacePage.isTabOpen(name), ...)`, not immediately after `workspaceFlow.delete()`. Real examples: `tests/workspace/tabs-open-pin-switch-close.spec.ts` (pin/switch/close/add), `tests/workspace/tabs-name-and-method-sync.spec.ts` (rename/method-change sync + auto-close-on-delete).

### Sidebar filter, pin, inline rename, right-click

```ts
// pageManager.workspacePage
filterSidebar(text: string): Promise<void>         // types into the "Projects filter" searchbox, narrowing the tree to matches (+ their ancestor project/collection)
clearSidebarFilter(): Promise<void>                  // clicks "Clear search", restoring the full tree
isPinned(name: string): Promise<boolean>             // whether the request currently shows in the sidebar's top-level "Pinned" section
renameRequestInline(name: string, newName: string): Promise<void>  // dblclick the row's editable label -> fill -> Enter; distinct from workspaceFlow.rename()'s context-menu "Rename" dialog
findItemNode(item: { id?: string; name: string }, type?: TreeNodeType, parent?: TreeNode): Promise<TreeNode | undefined>
  // looks up a tree node by id (preferred) or name, optionally scoped to a parent's subtree and/or a TreeNodeType
rightClick(node: TreeNode): Promise<void>            // scrolls the node's row into view and right-clicks it, opening its context menu
clickContextMenu(item: ContextMenuItem): Promise<void>  // clicks an already-open context menu's item by its fixed ContextMenuItem-enum label
clickItemContextMenu(nodeName: string, contextMenu: string, parent?: TreeNode): Promise<void>
  // findItemNode(by name) + rightClick + click a menu item by its visible label in one call. Unlike
  // clickContextMenu, the label isn't restricted to the ContextMenuItem enum — this is what a
  // plugin-injected request/collection action (a `requestActions` entry with a dynamic label) needs to
  // trigger. Throws if the node or the menu item is never found, instead of returning undefined/hanging.

// WorkspaceFlow
pin(request: HttpRequest | GraphQLRequest | GrpcRequest | EventStreamRequest | SocketIORequest | WebSocketRequest): Promise<void>
  // right-clicks the node -> ContextMenuItem.Pin — toggles: call it twice to pin then unpin
```

**Confirmed live**: multi-select via Ctrl/Cmd-click is not implemented in the app at all — the sidebar's `GridList` is hardcoded `selectionMode="single"` — so don't write a test expecting it; that's an app limitation, not a framework gap. Real examples: `tests/workspace/sidebar-filter-and-pin.spec.ts` (filter + pin/unpin), `tests/workspace/sidebar-settings-and-inline-rename.spec.ts` (inline rename + the per-node-type Settings dialogs below — Request/Collection/Folder, each asserting both `isModalOpen()` and that the dialog's Name field auto-focuses via `isFocused()`), `tests/plugin/context-menu-action-registration/collection-context-menu-action.spec.ts` + `request-context-menu-action.spec.ts` (`clickItemContextMenu()` triggering a plugin-registered `requestActions` entry on a Collection/Request node — both `test.fail()`-documented against INS-3511, per §9a).

### Sidebar keyboard navigation — arrow-key expand/collapse, Cmd/Ctrl+N create-menu shortcut

```ts
// pageManager.workspacePage
expand(node: TreeNode): Promise<void>              // focuses the folder's row, presses ArrowRight — no-op if already expanded
collapse(node: TreeNode): Promise<void>             // focuses the folder's row, presses ArrowLeft — no-op if already collapsed
  // Both poll isExpanded() to the expected state before returning (see gotcha below) — callers
  // never need their own settle-wait after calling either.
isExpanded(node: TreeNode): Promise<boolean>        // reads the row's own "Collapse {name}" toggle button (only rendered while expanded)
openCreateShortcut(node: TreeNode): Promise<void>
  // clicks the node to select it, waits for the row's selection to settle (see gotcha below), then
  // sends the platform's "show create menu" shortcut (Cmd+N on macOS, Ctrl+N elsewhere), opening
  // the Sidebar Shortcut Create Menu targeted at it. Confirmed live: the shortcut only opens the
  // menu — it does not create anything by itself, unlike workspaceFlow.create()'s own "+"-button
  // dropdown path.
isCreateShortcutShown(): Promise<boolean>           // whether that menu is currently open — a plain getByRole("menu") count, since only one menu is ever open at a time in this app
isFocusModePromptShown(): Promise<boolean>
  // whether the one-time "Welcome to focus mode" popover is visible (role="dialog", aria-label
  // "Sidebar focus mode onboarding") — shown the first time a workspace is focused while
  // Settings.sidebarFocusForCollections is on and never dismissed before
dismissFocusModePrompt(): Promise<void>             // clicks the popover's "Got It" button, waits for it to hide
goBackToProject(): Promise<void>
  // clicks the sidebar's "Back to all projects" button. Confirmed live: this does NOT un-narrow
  // back to the current project's own full collection list — it navigates all the way out to a
  // different, default project ("Personal Workspace"). Not useful for "switch to a sibling
  // collection within the same project while narrowed" — use the Command Palette
  // (workspaceFlow.search()/commandPalettePage.selectResult()) for that instead, since it's a
  // global overlay unaffected by sidebar narrowing.
```

```ts
// pageManager.preferencesPage
isSidebarFocusForCollectionsEnabled(): Promise<boolean>  // reads back the General tab's "Sidebar focus for collections" checkbox
```

```ts
// WorkspaceFlow
dismissFocusModePrompt(): Promise<boolean>
  // reads workspacePage.isFocusModePromptShown() and, if shown, dismisses it via
  // workspacePage.dismissFocusModePrompt() — a thin convenience wrapper combining the two
  // WorkspacePage calls above; returns the shown value read before dismissing. Same method name
  // as the WorkspacePage one it wraps, but on a different object (`workspaceFlow.` vs
  // `workspacePage.`) — not a collision.
```

Real example: `tests/workspace/folder-keyboard-navigation.spec.ts` — arrow-key expand/collapse and the Cmd/Ctrl+N shortcut against a selected folder; narrowly scoped out of insomnia-smoke-test's broader `focus-and-keyboard.test.ts`. `tests/workspace/request-pane-tab-order.spec.ts` and `tests/workspace/auto-focus-rules.spec.ts` (see the `pageManager` helpers section below) cover the rest of that smoke-test file's scope — a freshly created request focusing the URL bar, Tab order through Send/its dropdown/the tablist, and two real app bugs (INS-3587, INS-3588) where a new key/value row never actually gets the focus its own `autoFocus` prop promises. `tests/workspace/sidebar-focus-mode-onboarding.spec.ts` covers `workspacePage.isFocusModePromptShown()`/`workspaceFlow.dismissFocusModePrompt()` (two cases: shows-once-and-stays-dismissed-after-reload-and-after-switching-to-another-collection, never-shows-while-off).

**Two real timing races found via a 10-way-parallel stress rerun (2026-09-01), both fixed inside the Page layer — don't re-add a fixed `waitForTimeout()` workaround for either in a spec, the methods already handle it:**
- **`expand()`/`collapse()` vs. `isExpanded()`**: the app's own arrow-key handler (`project-navigation-sidebar.tsx`) flips a folder's collapsed state asynchronously — it does a `requestGroupMeta` DB read *before* patching the UI's query cache — so a bare keypress can resolve tens of ms before the row's expanded state actually changes. A live probe confirmed `isExpanded()` reading `false` immediately after `expand()`'s keypress resolved, then flipping to `true` only ~20-40ms later. Fixed by having `expand()`/`collapse()` poll `isExpanded()` to the expected state (private `waitForExpanded()`) before returning, instead of a caller reading `isExpanded()` once right after.
- **`openCreateShortcut()`'s menu closing itself**: the sidebar has a `useEffect` that force-closes the shortcut-create dropdown whenever its `selectedItemId` changes — but that id is computed asynchronously (an async resource fetch after a route change) and lags behind the click that selected the row. Clicking then immediately sending Ctrl+N can open the menu against the stale id; the click's delayed catch-up then fires the "selection changed" effect and closes the just-opened menu. Live probe confirmed: 12/15 runs opened the menu for exactly one 20ms tick then closed it (staying closed); 3/15 never opened it at all. Fixed by having `openCreateShortcut()` wait for the row's `aria-selected` to settle (private `waitForSelectionSettled()`) *before* sending Ctrl+N — once the click's async catch-up has already happened, its effect can't fire again to close a menu that hasn't opened yet. Verified 15/15 then 10/10 clean at `--repeat-each=10 --workers=10`.

**`sidebarFocusForCollections` is no longer version-gated** — the installed `/Applications/Insomnia.app` binary was rebuilt past `feat: add sidebar collection focus mode (INS-2912) (#10324)` (2026-08-25), and the feature is now live and spec'd. Two related things changed as a result:

- **The installed app now defaults `sidebarFocusForCollections` to `true`**, which auto-narrows the sidebar to a focused collection's own contents (hiding its sibling collections' rows) the moment any collection is clicked/navigated into. This broke `WorkspaceFlow`'s generic tree-scan lookups (`getCollection()`, `waitForFirstRealChild()`) for **every** spec that creates 2+ sibling collections, not just focus-mode-specific ones — so `misc/fixtures.ts`'s `user` fixture now explicitly calls `preferencesFlow.set({ sidebarFocusForCollections: false })` right after `workspacePage.navigate()`, keeping every pre-existing spec's sidebar behavior unchanged by default. A spec that wants focus mode (like the one above) turns it back on itself.
- **Fixed a real bug found along the way**: `WorkspacePage.waitForFirstRealChild()` had no timeout at all — it looped forever if its `parentId` stopped appearing in the scraped tree, which is exactly what focus-mode narrowing does to a collection's own row. It now has a bounded deadline (throws instead of hanging) and falls back to the tree's own roots as the parent's children when the parent itself has been narrowed away. Also fixed `WorkspacePage.clickRename()`, which waited on a bare unscoped `getByRole("dialog")` to close — any other simultaneously-open dialog (e.g. the focus-mode onboarding popover) also matches `role="dialog"` and never closes on its own, so the wait could hang on the wrong dialog; it's now scoped to the dialog containing the rename prompt's own input.

### Generic modals & breadcrumb

```ts
// pageManager.workspacePage
isModalOpen(headingText: string): Promise<boolean>   // every simple modal (Request/Collection Settings, etc.) shares one generic dialog role — scope by heading text to tell them apart
closeModal(): Promise<void>                           // Escape — covers both the legacy Modal/ModalHeader pair AND newer react-aria-components Dialogs (e.g. Collection/Workspace Settings) whose "x" button carries no accessible name at all
getBreadcrumb(): Promise<string[]>                     // the current pane's breadcrumb trail, e.g. [Project, Collection, Request]; a Collection with no active request/folder renders just the first two levels. A request's level strips its leading HTTP-method line (e.g. "GET\nMy Request" → "My Request")
waitForBreadcrumbSettled(expected: string[]): Promise<string[]>   // polls getBreadcrumb() until it equals `expected` — the breadcrumb lags the newly-selected node by a render tick, so read it through this instead of a single bare getBreadcrumb() call right after selecting/navigating to a node
```

Real example: `tests/workspace/sidebar-settings-and-inline-rename.spec.ts` (Request/Collection/Folder Settings dialogs via `isModalOpen()`), `tests/workspace/command-palette.spec.ts` (breadcrumb settled via `waitForBreadcrumbSettled()` after jumping to a Collection), `tests/workspace/sidebar-drag-drop-into-folder.spec.ts` (request-level breadcrumb after a reparent, including the collapsed-folder-name "..." case).

### Command Palette (Cmd/Ctrl+P quick search / jump-to)

No separate `CommandPaletteFlow` — the palette's search entry point lives directly on `workspaceFlow`:

```ts
// WorkspaceFlow
search(query: string): Promise<string[]>   // opens the palette, types query, returns the matching result names in on-screen order
getByPalette<T = WorkspaceItem>(name: string): Promise<T | undefined>
  // opens the palette, searches name, clicks the first matching result (navigating to it), then
  // resolves it the same way get() does. Useful for jumping straight to a sibling item that a
  // narrowed sidebar (e.g. Settings.sidebarFocusForCollections) has hidden from the tree scan
  // get()/getCollection() rely on — see goBackToProject()'s note above for why that narrowing
  // rules out the plain tree-based getters for this case.
```

```ts
// pageManager.commandPalettePage (pages/command-palette.page.ts) — direct access for anything beyond a bare search
open(): Promise<void>                       // clicks the toolbar's "Search.." trigger button
openViaShortcut(): Promise<void>             // Cmd+P (macOS)
search(query: string): Promise<void>         // fills the search input; waits out its 250ms debounce + round trip
getResultNames(): Promise<string[]>          // every listed result across all sections (Requests/Collections, documents/Environments/etc.)
selectResult(name: string): Promise<void>    // clicks the first result whose text contains `name`, navigating to it
close(): Promise<void>                       // Escape twice — the first only clears the search input, the second dismisses the dialog
```

**Confirmed live**: the results listbox is a Popover portaled outside the dialog element's own DOM subtree, so `CommandPalettePage`'s result-option selector is deliberately NOT scoped under its dialog selector — keep that if you touch this file. Real example: `tests/workspace/command-palette.spec.ts` (jumping to a request and to a collection by name, plus the keyboard-shortcut open path).

## Collection Runner (`workspaceFlow.run()`/`.openRunner()`, tests under `tests/runner/`)

There is no separate `RunnerFlow` — the Collection Runner is reached by right-clicking a Collection, so its two entry points live directly on `workspaceFlow`:

```ts
// WorkspaceFlow
run(collection: Collection, options?: RunnerOptions): Promise<RunnerRunResult>
  // right-clicks collection → "Run Collection" → applies options → clicks Run → waits until every
  // configured iteration has a result for every selected request → returns the aggregate + per-iteration results
openRunner(collection: Collection, options?: RunnerOptions): Promise<void>
  // does everything run() does EXCEPT click Run and wait — use this instead of run() when a test needs to
  // interact with the Runner while a run is in flight (Cancel/Skip), or wants direct pageManager.runnerPage access
  // before starting it
```

```ts
// RunnerOptions (models/runner.ts) — plain object literal, per the Model-literal convention
{ iterations?: number; delay?: number; keepLogs?: boolean; bail?: boolean; dataFilePath?: string }
// keepLogs -> "Keep logs after run" checkbox; bail -> "Stop run if an error occurs" checkbox
// dataFilePath -> absolute path to a .json/.csv file, uploaded via RunnerPage.uploadData(); uploading
// N rows overrides the Iterations input to N (confirmed live) — set options.iterations afterward if you
// need a different count anyway, since run()/openRunner() apply dataFilePath before iterations/delay.
// "Persist responses for a session" has NO field here — confirmed live that its checkbox is rendered
// `disabled` in the current app build, so there is nothing a setter could do.

// RunnerRunResult (returned by run())
{ testResultCount: { passed: number; total: number };  // counts insomnia.test() ASSERTIONS across the whole
                                                         // run, not requests — a run with no test script legitimately
                                                         // reports 0/0 even with real, successful responses
  iterationResults: Map<"All" | "Passed" | "Failed" | "Skipped", RunnerIterationResult[]> }
  // RunnerIterationResult = { iteration: number; results: RunnerTestResult[] }
  // RunnerTestResult = { name: string; status: string; durationMs?: number; bytes?: number }
  // Gotcha confirmed live (superseding an earlier, now-stale note that claimed the four filter keys held
  // identical data): the All/Passed/Failed/Skipped buttons DO filter which request rows appear, by that
  // request's own insomnia.test() outcome — `.get("All")` has every request; `.get("Passed")` only
  // requests whose test(s) all passed; `.get("Failed")` only requests with a failing test. A request
  // that errors before any response (so no test ever runs, e.g. an unreachable URL) or has no
  // after-response script at all appears ONLY under "All" — not under "Skipped" either, which is for an
  // explicit `insomnia.test.skip()` block. When a filter has nothing to show for an iteration, that
  // iteration doesn't render at all — `.get("Skipped")` is `[]` (length 0), not `iterations`-many
  // entries with an empty `results` array, when nothing was skipped.
```

```ts
// pageManager.runnerPage direct access (needed for anything openRunner() doesn't cover)
getRequestOrder(): Promise<{ name: string; method: string; selected: boolean }[]>
clickRun(): Promise<void>
cancelRun(): Promise<void>              // "Cancel all" — only visible while a run is in flight
skipItem(name: string): Promise<void>   // "Skip" on a request's LIVE progress card — only while pending/running
getStatus(): Promise<{ running: boolean; finished: number; total: number; skipped: number; canceled: number } | undefined>
getItemStatus(name: string): Promise<string | undefined>   // e.g. "SKIPPED"/"CANCELED"/"RUNNING"/"200 OK"
getTestResultCount() / getIterationResults() / getIterationResultsByFilter()
uploadData(filePath: string): Promise<void>   // see RunnerOptions.dataFilePath above — prefer passing dataFilePath through run()/openRunner() instead of calling this directly
setIterations() / getIterations() / setDelay() / setKeepLogs() / setBail()
// getKeepLogs()/getBail()/getDelay() (read-back getters for the three above — every current test asserts run
// behavior/getStatus() instead of reading the option form back) and toggleRequestSelection()/clickSelectAll()/
// getSelectedRequestNames()/selectRunOption()/switchResultTab()/filterResultsByName()/toggleResultDetail() (per-request
// selection and result-tab/detail UI) were removed as dead code — no test called any of them. Re-add whichever a
// future test needs, e.g. deselecting a request before a run.
```

**Confirmed live, non-obvious app behavior:**

- **Newly created requests are prepended, not appended** — a Collection's actual Runner execution order (and the left-panel "Request Order" list) is the _reverse_ of the order the requests were created in. To make request A run before B before C, create them in reverse: C first, then B, then A.
- **`insomnia.execution.setNextRequest(nameOrId)`** (called from a pre- or after-response script) only scans _forward_ from the current position — it marks every request between the current one and the named target as `status: "SKIPPED"` in the results, then resumes normal execution at the target. It cannot jump backward to an earlier request in the same iteration. `insomnia.execution.skipRequest()` (self-skip, pre-request script only) is a different mechanism — it cancels that request's own send.
- **Cross-request variable reads**: `insomnia.variables.set(key, value)` in one request's script is readable via `insomnia.variables.get(key)` in a later request's script within the _same run_ (transient variables are threaded through the whole run, not per-request). Real example: `tests/runner/cross-request-variable-read.spec.ts`.
- **Data-file-driven iteration**: an uploaded row's fields are exposed to scripts as `insomnia.iterationData.get(key)` (NOT merged into `insomnia.environment`); `insomnia.info.iteration`/`.iterationCount` give the 1-based current iteration/total. Real example: `tests/runner/upload-data-driven-iteration/upload-data-driven-iteration.spec.ts` (own directory since it carries a `.json` fixture, per the fixture-file convention below).
- A **skipped** result row (via UI Skip or `setNextRequest`) has no "Xms - Y bytes" line at all — `RunnerTestResult.durationMs`/`.bytes` are `undefined` for it, only `status` is set (`"SKIPPED"`/`"CANCELED"`).

Real examples: `tests/runner/happy-path.spec.ts` (iterations/delay/keepLogs/bail, aggregate + per-iteration results, a genuinely-failing request), `tests/runner/cancel-and-skip-run.spec.ts` (`openRunner()` + live Skip/Cancel), `tests/runner/set-next-request-skips-forward.spec.ts`, `tests/runner/cross-request-variable-read.spec.ts`, `tests/runner/upload-data-driven-iteration/upload-data-driven-iteration.spec.ts`.

## Per-domain request flows (http / graphql / grpc / websocket / socket.io / event-stream)

These five share nearly the same shape. `create()`/`send()` are consistent; only `connect`/`disconnect`/`sendMessage` vary by protocol (a plain request/response protocol like HTTP/GraphQL/gRPC has no connect/disconnect).

```ts
// HttpRequestFlow
create(parent: Collection | Folder, request: HttpRequest): Promise<HttpRequest>
send(request: HttpRequest): Promise<Response>
get(item: string | { name: string; id?: string }, parent?: Collection): Promise<HttpRequest | undefined>
// Confirmed live: a freshly created request already has implicit default headers (Accept, Host, User-Agent)
// showing up in httpRequestPage.getHeaders() — it's NOT an empty array like a fresh request's params are.
// Don't assert headersBefore.length === 0 on a new request; assert on the delta (headersAfter.length ===
// headersBefore.length + 1) or on absence of a blank {name:"", value:""} entry instead. See
// tests/http-request/key-value-editor-blank-row.spec.ts.
// Confirmed live, fixed in the shared BasePage: setCodeMirrorValue()'s immediate read-back only confirms
// the write landed at that instant, not that it holds — a background re-render (e.g. a `{{ }}`/`{% %}`
// tag's inline widget redrawing) can silently revert it shortly after, which a caller that re-navigates
// immediately afterward (e.g. HttpRequestFlow.create() setting both url and body, then reading the
// request back right away) could observe as the field having raced back to its old value. This is fixed
// once, generically, inside setCodeMirrorValue() itself (watches the value for 200ms after each write,
// retrying the whole write up to 3 times on a caught revert) rather than per-caller — setUrl() is now a
// thin passthrough with no wait/retry logic of its own, and any other CodeMirror-backed setter (e.g.
// GraphQLRequestPage.setBody()) gets the same protection for free. getUrl() itself separately polls
// until a CodeMirror instance is actually attached before reading it (a just-created/edited request's
// URL bar can still be mid-remount right after re-navigating to it) rather than returning "" the instant
// no instance is found yet.
// Confirmed live, a stronger case of the same race: on a request whose backing document is still
// mid-creation, setCodeMirrorValue()'s built-in 200ms hold-check/retry is NOT always enough — reliably
// reproducible for a URL containing a `{% %}` tag (its inline widget decoration re-renders the editor
// around the same time), the value can be silently reverted and never recover on its own, on disk as
// well as on screen; typing the same text via real keystrokes instead of setUrl() never hits this.
// HttpRequestFlow.create() now verifies the URL actually landed in the on-disk `Request` NeDB file
// right after setUrl() (private waitForUrlPersisted(), built on BaseFlow's shared protected
// waitForFieldPersisted()/private readPersistedDoc()), re-issuing setUrl() once if not.
// GrpcRequestFlow's own setUrl()/setBody() waits go through the same shared
// BaseFlow.waitForFieldPersisted() (passively, with no re-issued write —
// see BaseFlow for why the two differ). A spec creating a request whose URL embeds a template tag
// doesn't need to do anything extra — this is handled inside create() — but keep it in mind if you're
// calling HttpRequestPage.setUrl() directly, outside a Flow, on a request that might still be
// mid-creation.

// GraphQLRequestFlow — identical shape
create(parent: Collection | Folder, request: GraphQLRequest): Promise<GraphQLRequest>
send(request: GraphQLRequest): Promise<Response>
get(item, parent?: Collection): Promise<GraphQLRequest | undefined>
// create() auto-clicks "Prettify GraphQL" right after setBody() (whenever request.body is given), so the query persisted/read back is already reformatted — a request created with a one-line query comes back multi-line. GraphQLRequestPage.prettify() is the underlying Page method (switches to the content-type tab, clicks the plain-text "Prettify GraphQL" button — no aria-label/data-testid on it) if you need to call it directly (e.g. re-prettifying after a later setBody()).

// GrpcRequestFlow
create(parent: Collection | Folder, request: GrpcRequest): Promise<GrpcRequest>
send(request: GrpcRequest): Promise<GrpcResponse>   // GrpcResponse = { status?: { code, message }, message?: unknown, messages?: unknown[] } — NOT the shared Response type. Covers unary AND server-streaming (waits for the whole call to complete); `message` is `messages[0]`.
get(item, parent?: Collection): Promise<GrpcRequest | undefined>
// Client-streaming / bidi-streaming (methodType "client"/"bidi" — the method-type tab reads "Client Streaming"/"Bi-directional Streaming"): use start()/streamMessage()/commit() instead of send(), since no response arrives until the client half of the stream is closed.
start(request: GrpcRequest): Promise<void>                                  // clicks "Start"; does NOT wait for a response
streamMessage(request: GrpcRequest, body: string): Promise<void>            // streams one message over the open call; call repeatedly with different bodies
commit(request: GrpcRequest): Promise<GrpcResponse>                         // closes the client half ("Commit"), then reads back status + message(s)
cancel(request: GrpcRequest): Promise<GrpcResponse>                         // cancels an in-flight unary/server-streaming call, or an open client/bidi stream
// A gRPC business error (server calls back with a non-OK status, e.g. INVALID_ARGUMENT) surfaces as an error dialog, not a GrpcResponse — `send()`/`commit()` reject; assert with `await expect(grpcRequestFlow.send(request)).rejects.toThrow(/INVALID_ARGUMENT.../)`. (Real app quirk: `isGrpcConnectionError()`'s `Array.find(...) !== null` check is always true since `.find()` returns `undefined` on no match, so every gRPC business error pops the same ErrorModal a connection error would.)
// fetchServerReflection() is @throwOnDialog-decorated — against an unreachable server it rejects with the error dialog's text, same pattern as send()/commit(): `await expect(pageManager.grpcRequestPage.fetchServerReflection()).rejects.toThrow(/Uh Oh!.*UNAVAILABLE/s)`.
// GrpcRequestPage's getMethodType()/isRunning()/openProtoFile()/useRequestStubs() were removed as dead code (no test ever called them) — re-add a public getter/action there if a future test needs to read the method-type tab, check the running state, or drive proto-file import/stub-generation directly.
// misc/grpc-server.js's lotsOfReplies (server-streaming) reads an optional "x-reply-delay-ms" metadata header to control the delay between writes (default 50ms) — set it higher (e.g. 1000) in a request's headers to widen the window for a reliable mid-stream cancel test.

// WebSocketRequestFlow
create(parent: Collection | Folder, request: WebSocketRequest): Promise<WebSocketRequest>
send(request: WebSocketRequest): Promise<Response>          // opens the connection
sendMessage(request: WebSocketRequest, body: WebSocketRequestBody, callback = () => {}, timeout = 5000): Promise<Response>
  // sends one message over an already-open connection; call repeatedly with different bodies to send several messages of different content types (body.contentType accepts any ContentType value — see tests/web-socket-request/send-multiple-message-types.spec.ts for an example using two of them)
disconnect(request: WebSocketRequest, callback: () => Promise<void> | void = () => {}, timeout = 5000): Promise<Response>
get(item, parent?: Collection): Promise<WebSocketRequest | undefined>

// SocketIORequestFlow
create(parent: Collection | Folder, request: SocketIORequest): Promise<SocketIORequest>
connect(request: SocketIORequest): Promise<void>
sendMessage(request: SocketIORequest): Promise<Response>
disconnect(request: SocketIORequest, callback = () => {}, timeout = 5000): Promise<Response>
get(item, parent?: Collection): Promise<SocketIORequest | undefined>

// EventStreamRequestFlow
create(parent: Collection | Folder, request: EventStreamRequest): Promise<EventStreamRequest>
send(request: EventStreamRequest): Promise<Response>          // opens the SSE connection
get(item, parent?: Collection): Promise<EventStreamRequest | undefined>
// No Flow-level disconnect() — the one that used to be here was removed as dead code (no test called it).
// To close the connection, call the inherited pageManager.eventStreamRequestPage.disconnect(callback?, timeout?): Promise<void>
// directly (see the generic RequestPage helpers below), then pageManager.responsePage.get() if you need the Response back.
```

Every `get()` above takes an optional second `parent?: Collection` — pass a Document's `document.collection` to look it up in that Document's Collection tab instead of the project navigation tree (see "`document.collection`" below).

`callback` on `disconnect`/`sendMessage`-adjacent calls runs **while the connection is still open**, wrapped internally in `expect(async () => { await callback() }).toPass({ timeout })` — put assertions about live stream events there instead of polling after the fact. Real examples: `tests/web-socket-request/happy-path.spec.ts:29`, `tests/socket-io-request/happy-path.spec.ts:38`.

### Request models (fields you're allowed to pass)

```ts
// HttpRequest / GraphQLRequest / EventStreamRequest — identical field set
{ name: string; url: string; method: HttpMethod;
  body?: { mimeType?: ContentType; text?: string; fileName?: string; params?: RequestBodyParameter[] };
  params?: RequestParameter[]; headers?: RequestHeader[];
  preRequestScript?: string; afterResponseScript?: string; id?: string }
// body.params (RequestBodyParameter[]) is for ContentType.Multipart/Form key-value rows; body.fileName is for ContentType.File
// RequestHeader/RequestParameter/RequestBodyParameter are re-exported from models/http-request.ts (and the analogous per-domain model files) —
// each carries more than just name/value: RequestHeader adds id?/description?/disabled?; RequestParameter adds those plus type?/multiline?

// GrpcRequest
{ name: string; url: string; method?: string; body?: string; headers?: GrpcRequestHeader[]; id?: string }

// WebSocketRequest
{ name: string; url: string; body?: { contentType: ContentType; content: string };
  // contentType accepts any ContentType value, not just JSON/Plain — see tests/web-socket-request/send-multiple-message-types.spec.ts for an example using two of them
  params?: RequestParameter[]; headers?: RequestHeader[]; id?: string }

// SocketIORequest
{ name: string; url: string; headers?: RequestHeader[];
  message?: { eventName: string; payload: string }; id?: string }
```

### Authentication (Auth tab) — OAuth 1.0 + OAuth 2.0 wired up; Folder inheritance too

`HttpRequest` is currently the only per-domain request model with an `authentication` field. OAuth 1.0 and OAuth 2.0 both have full Page setter/getter support — every other `AuthType` option (see Enums below) still has none:

```ts
// HttpRequest
{ ...; authentication?: RequestAuthentication }
// RequestAuthentication / AuthTypeOAuth1 / AuthTypeOAuth2 re-exported from models/http-request.ts (ultimately from insomnia-data/src/models/request)

// AuthTypeOAuth1
{ type: "oauth1"; consumerKey?: string; consumerSecret?: string; tokenKey?: string; tokenSecret?: string;
  signatureMethod?: OAuth1SignatureMethod; callback?: string; version?: string; timestamp?: string;
  realm?: string; nonce?: string; verifier?: string; disabled?: boolean; privateKey?: string; includeBodyHash?: boolean }
// privateKey/includeBodyHash have no Page setter/getter yet — nothing exercises RSA-SHA1 (the one signature method that needs privateKey) today

// AuthTypeOAuth2
{ type: "oauth2"; grantType: "authorization_code" | "implicit" | "password" | "client_credentials" | "refresh_token" | "mcp_auth_flow";
  authorizationUrl?: string; accessTokenUrl?: string; clientId?: string; clientSecret?: string;
  redirectUrl?: string; useDefaultBrowser?: boolean; usePkce?: boolean; pkceMethod?: string; // "S256" | "plain" in practice, field is a bare string
  responseType?: "code" | "id_token" | "id_token token" | "none" | "token"; // the Implicit grant's "Response Type" select
  username?: string; password?: string; // Resource Owner Password grant only
  scope?: string; state?: string; audience?: string; resource?: string; origin?: string; tokenPrefix?: string; credentialsInBody?: boolean;
  code?: string; accessToken?: string; refreshToken?: string; disabled?: boolean; clientIdIssuedAt?: number; clientSecretExpiresAt?: number }
// No separate identityToken/idToken field on the model — the id_token the Implicit/Authorization Code grants can return only shows up
// in the Auth tab's own read-only "Identity Token" display field (OAuth2Tokens.identityToken below), not on AuthTypeOAuth2 itself.
```

`HttpRequestFlow.create()`'s `applyRequestFields()` calls a private `applyAuthentication()` whenever `request.authentication` is given — it branches on `authentication.type`, calling `page.setOAuth1Fields(authentication)` or `page.setOAuth2Fields(authentication)`; extend that branch (and its own Page setter) before another `AuthType` can be composed through `create()`.

**`pages/auth-tab.page.ts`'s `AuthTabPage` is the shared base** both `RequestPage` (every protocol's request Page, though only `HttpRequest`'s Model carries `authentication`) and `FolderPage` extend — a subclass only has to supply its own `PANE` selector; every method below works identically on a request's Auth tab or a Folder's:

```ts
// pageManager.httpRequestPage / pageManager.folderPage (both extend AuthTabPage)
setAuthType(type: AuthType): Promise<void>            // switches to the Auth tab, opens the dropdown, selects `type`
setOAuth1Fields(fields: Partial<AuthTypeOAuth1>): Promise<void>  // switches auth type to OAuth 1.0 first; fields left undefined are not written, leaving whatever's already there
setOAuth2Fields(fields: Partial<AuthTypeOAuth2>): Promise<void>  // switches to OAuth 2.0, sets grantType first (it controls which other rows render), auto-expands "Advanced Options" for scope/state/tokenPrefix/audience/resource/origin/credentialsInBody/responseType, silently skips a field with no row for the current grant type
fetchOAuth2Tokens(): Promise<void>                    // clicks "Fetch Tokens" (or "Refresh Token", once a token already exists) and waits for the Access Token field to populate — see popup-vs-not below
getOAuth2Tokens(): Promise<OAuth2Tokens>              // { refreshToken; identityToken; accessToken } — reads the 3 read-only display inputs; "" means not fetched yet
clearOAuth2Tokens(): Promise<void>                    // clicks the "Clear" button next to Refresh Token/Fetch Tokens (only rendered once a token exists) — wipes the 3 fields. NOT the same as "Advanced Options"' own "Clear OAuth 2 session" button, which resets the popup's embedded browser session/cookies, not the app's stored tokens
```

`getAuthType()`/`getOAuth1Fields()`/`getOAuth2Fields()`/`getAuthentication()`/`expandOAuth2AdvancedOptions()` used to exist as read-back helpers but were removed (dead code — no test ever called them; `expandOAuth2AdvancedOptions()`'s behavior lives on as a private step inside `setOAuth2Fields()`). **AuthTabPage is write-only from a spec's perspective today** — the only way to read auth state back is `getOAuth2Tokens()` for tokens, or asserting on the app's externally-visible behavior (e.g. the request's outgoing `Authorization` header). Add a public getter back to `pages/auth-tab.page.ts` if a future test needs to read OAuth1/OAuth2 fields or the current auth type.

**Confirmed live, non-obvious DOM structure**: the Refresh/Identity/Access Token display inputs have **no `id` of their own** — only their wrapping `<label>` carries a (dangling) `for="Access-Token"`-style attribute, so they're read via `label[for="Access-Token"] input`, never a `#Access-Token` id selector (that silently matches nothing). "Response Type" (Implicit grant) lives inside "Advanced Options" exactly like Scope/State/etc., even though it isn't obviously an "advanced" field — `setOAuth2Fields()` already accounts for this. The token-fetch button's own accessible name flips from "Fetch Tokens" to "Refresh Token" once a token exists — `fetchOAuth2Tokens()` matches either. Clicking it again when a refresh token is already stored performs an actual `grant_type=refresh_token` exchange (new access token, same refresh token) **without reopening the popup** — confirmed via `insomnia.windows().length` staying flat across the second call.

**Popup vs. no popup, confirmed live**: Authorization Code and Implicit both open a real Electron popup window (`insomnia.waitForEvent("window")` fires) that navigates through `/authorize` and closes itself once the redirect lands — `fetchOAuth2Tokens()`'s wait condition (`Access Token` becomes non-empty) covers this transparently, no popup-handling code needed in a spec. Client Credentials, Resource Owner Password, and a refresh-token re-fetch never open a popup — verified by diffing `insomnia.windows().length` before/after. **App quirk, not a test bug**: with the Implicit grant's Response Type set to plain `"id_token"` (no `"token"`), the Access Token display field still ends up populated — with the _same_ JWT as Identity Token, labeled "(never expires)" instead of a real TTL — rather than staying empty; assert `accessToken === identityToken` for that case, not `accessToken === ""`.

`HttpRequestFlow.fetchOAuth2Tokens(request): Promise<OAuth2Tokens>` wraps navigate + `page.fetchOAuth2Tokens()` + `page.getOAuth2Tokens()` in one call (mirrors how `send()` wraps navigate + send + read-response) — prefer it in specs over driving `httpRequestPage` directly. `FolderFlow.fetchOAuth2Tokens(folder): Promise<OAuth2Tokens>` is the same convenience for a Folder's own Auth tab (wraps `open(folder)` + `page.fetchOAuth2Tokens()` + `page.getOAuth2Tokens()`) — prefer it over driving `folderPage` directly too.

**Folder-level OAuth 2.0 + `AuthType.Inherit`**: a Folder's own Auth tab (opened via `folderFlow.open(folder)` → `pageManager.folderPage`, itself an `AuthTabPage`) can carry a full OAuth 2.0 config exactly like a request's. A child request set to `AuthType.Inherit` (`setAuthType(AuthType.Inherit)`) picks up the folder's authentication at `send()` time — confirmed live end-to-end with Client Credentials (fetch the folder's tokens once via `folderFlow.fetchOAuth2Tokens(folder)`, then a child request's `send()` carries that same `Bearer <token>` with no auth configured on the request itself). `HttpRequestFlow.create()`'s `parent` param is typed `Collection | Folder` — `httpRequestFlow.create(folder, {...})` creates the request as the folder's child rather than the collection's, no cast needed.

Real examples: `tests/http-request/oauth1-authentication.spec.ts` (OAuth 1.0 — signed `Authorization: OAuth ...` header), `tests/http-request/oauth2-authorization-code.spec.ts` / `oauth2-authorization-code-pkce.spec.ts` (S256 + plain) / `oauth2-implicit.spec.ts` (ID Token / ID+Access Token) / `oauth2-client-credentials.spec.ts` / `oauth2-password.spec.ts` / `oauth2-token-refresh-clear.spec.ts` (refresh + clear) / `oauth2-folder-inherited-auth.spec.ts`.

### `Response` (returned by `send`/`disconnect`/`callTool`)

```ts
{ statusCode?: number; statusMessage?: string; elapsedTime?: number; bytesContent?: number;
  headers?: ResponseHeader[]; body?: unknown; console?: string; events?: { data: string; time: string; preview?: unknown }[];
  tests?: { name: string; status: string; error?: string }[] }
```

`events` is what SSE/WebSocket/Socket.IO/MCP streamed messages land in — read via `pageManager.responsePage.getEvents()` or `response.events`.

`tests` is what `insomnia.test()`/`insomnia.expect()` calls in a pre-request or after-response script populate — read via `response.tests` (already included in every `send()`'s returned `Response`; `ResponsePage.getTestResults()` is a private helper `get()` calls internally, not something a spec calls directly). `status` is the literal rendered badge text ("PASS"/"FAIL"/possibly "SKIP" — the tab bar also has a "Skipped" filter, unconfirmed live); `error` is only set on a FAIL row, containing the raw `" | error: ... | ACTUAL: ... | EXPECTED: ..."` text. **Gotcha confirmed live**: the test-name `<span>` has a CSS `capitalize` class, so `.innerText()` returns the visually-transformed text ("Transient Var" for a test named `'transient var'`) — `getTestResults()` uses `.textContent()` instead to get the real, untransformed name back. Rows are not returned in script-declaration order — the app groups/sorts them (FAIL rows before PASS rows, observed consistently), so assert with `expect.arrayContaining(...)`, not an exact-order array. Real example: `tests/http-request/after-response-script-test-results.spec.ts`.

**Known gap, not yet resolved**: `insomnia.environment.set()`/`.baseEnvironment.set()` calls made inside an **after-response** script (as opposed to pre-request, where they're already proven reliable — see `pre-request-script-environment-variables.spec.ts`) were not observed to persist when read back afterward via `environmentFlow.get()`, even after re-navigating to the environment editor and waiting a couple of seconds. Root cause unconfirmed (may be a timing/debounce issue specific to after-response scripts, or the read-back path itself) — don't rely on after-response environment writes being visible to a subsequent `environmentFlow.get()`/`.link()` until this is investigated further. `insomnia.globals`/`.baseGlobals` were also probed and appear to write into the same sub/base environment `insomnia.environment`/`.baseEnvironment` already point at (not a separate scope) — but this was only observed once, alongside the same persistence gap above, so treat it as unconfirmed too.

## `mcpClientFlow`

```ts
create(parent: Project, client: McpClient): Promise<McpClient>     // McpClient = new McpClient(name, url = "")
get(item: string | { name: string; id?: string }): Promise<McpClient | undefined>
connect(client: McpClient): Promise<void>
getTools(client: McpClient): Promise<string[]>
callTool(client: McpClient, tool: string, args: Record<string, string>, callback: () => Promise<void> | void = () => {}, timeout = 5000): Promise<Response>
```

Real example with the live mock MCP server: `tests/mcp-client/happy-path.spec.ts`.

## `environmentFlow`

```ts
create(parent: Project | Environment, environment: Environment): Promise<Environment>
// parent = Project  → creates/renames the workspace's Base Environment
// parent = Environment (isEnvironmentItem(parent) true) → creates a sub-environment under it
link(item: Collection | McpClient | <any request type>, environment: Environment): Promise<void>
  // environment MUST be the object returned by create() — it needs environment.containerName
  // item can be a Document's document.collection (Collection with documentId set) — link()
  // opens that Document's Collection tab first, since the picker only renders there,
  // not on the Document's default Spec tab
activate(collection: Collection, name: string): Promise<void>
  // opens `collection`'s node, then activates one of its OWN built-in "Collection Environments"
  // (its Base Environment, or a private/shared sub-environment nested directly under it — e.g.
  // from an imported legacy-format collection) via the "Select a Collection Environment" picker.
  // Distinct from link(), which instead attaches a separate Project Environment via the separate
  // "Select a Project Environment" picker next to it — confirmed live: both pickers operate
  // independently, activating one doesn't clear the other, and their variables merge into the
  // same active render context. Use this one when the scenario's environment/sub-environment
  // already lives inside the collection itself (e.g. straight out of an import) rather than being
  // a Project Environment created via environmentFlow.create()+link().
  //
  // As of 2026-09-03 the picker is two independent popovers, not one "Manage Environments"
  // dialog — EnvironmentPage.linkProjectEnvironment()/selectCollectionEnvironment() (which
  // link()/activate() wrap) drive `button[aria-label="Select a Project/Collection Environment"]`
  // → `listbox[aria-label="Select a Project/Collection Environment"]` respectively, each a single
  // flattened list (a base row followed by its own indented sub-environment rows) — no more
  // combobox-then-second-listbox two-step for linking a sub-environment. The literal string
  // "Manage Environments" still exists, but only on the deep-edit modal opened via the icon
  // button `aria-label="Manage collection environments"` inside the Collection Environment
  // popover, and it now only edits that collection's OWN base/sub-environments (no project-
  // environment combobox in it anymore). Passing "No Project Environment" as link()'s/
  // linkProjectEnvironment()'s containerName unlinks the current Project Environment, since
  // that sentinel is itself a normal selectable row.
get(item: string | { name: string; id?: string }): Promise<Environment | undefined>
```

`Environment` model (pass as a plain object literal, per the Model-literal convention above — not `new Environment(...)`):

```ts
{ name: string; isPrivate?: boolean; type?: ...; kvPairData?: EnvironmentKvPairData[]; containerName?: string; id?: string }
```

`kvPairData` entries: `{ id: string; name: string; value: string; type: EnvironmentKvPairDataType; enabled?: boolean }` — `EnvironmentKvPairDataType` is re-exported from `models/environment.ts` (e.g. `.STRING`). Real example: `tests/data/import/url/import-swagger-api.spec.ts`.

```ts
// pageManager.environmentPage — lower-level row access, no EnvironmentFlow wrapper (setVariables()/getVariables() cover the whole-list case above)
// addRow() (clicked "Add Row") and getName() (read the pane heading) were removed as dead code — no test called either;
// setVariables() never needs an explicit "Add Row" click since typing into the always-present trailing blank row is what creates the next one
getRow(name: string): Locator                 // locates a committed row by its current name/value text — never matches the always-present trailing blank row
deleteRow(row: Locator): Promise<void>         // deletes one row, e.g. environmentPage.deleteRow(environmentPage.getRow(name))
// deleteAll() is private — setVariables() calls it internally before adding its list; no test clears the list on its own
toggleRawEdit(): Promise<void>                 // toggles the pane between the Table Editor and the raw JSON editor
getRawJson(): Promise<string>                  // reads the raw JSON editor's current text — call only once toggleRawEdit() has switched into raw view
setRawJson(json: string): Promise<void>        // replaces the raw JSON editor's text; waits out its debounced fetcher submission internally (no visible "saving" signal to poll on, so this is a fixed 1000ms wait — confirmed live that anything much shorter can lose the write on a subsequent reload)
```

To disable a row via the Table Editor UI directly (distinct from `setVariables()`'s `enabled: false`, which does the same thing as part of building a whole list): `environmentPage.getRow(name).getByRole("button", { name: "Disable Row" }).click()`, then read back via `getVariables()`. Real example: `tests/environment/table-editor-disable-row.spec.ts`.

**Confirmed live gotcha**: "Delete Row"/"Delete All" are both `PromptButton`s (a 2-second-window confirm control) — a single `.click()` only arms the confirmation and does NOT delete anything; `deleteRow()`/the private `deleteAll()` both click twice internally to actually confirm. If you ever call the underlying button locator directly instead of these methods, remember it needs two clicks. `RequestPage.setKeyValuePairs()`'s own "Delete all" click (used by `httpRequestPage.setHeaders()`/`.setParams()`, etc.) is the same `PromptButton` component and has NOT been audited/fixed the same way — it has just never been exercised against a non-empty list yet (every current caller only ever calls it right after creating a fresh, empty request), so treat it as an unconfirmed latent risk if you write a test that calls `setHeaders()`/`setParams()` a second time on a request that already has entries. Real example: `tests/environment/key-value-editor-blank-row.spec.ts`.

**Confirmed live bug, fixed in place**: `toggleRawEdit()` used to only match the "Raw Edit" aria-label on the toggle button — but that same button's aria-label flips to "Table Edit" once the raw view is active (its rendered _text_ is always the unrelated static "Table View" — only the aria-label carries the real state), so a second call to switch back from raw to table hung forever waiting on a selector that no longer existed. Fixed to match either label. Switching table→raw is straightforward; switching raw→table this way is still unconfirmed to actually flip the environment's underlying type in every case (see the reload-based persistence check `json-raw-editor.spec.ts` uses instead of round-tripping the toggle) — prefer `page.reload()` + re-`selectEnvironment()` over toggling back if a test needs to confirm a raw-JSON write actually persisted.

**Secret-typed variables (`EnvironmentKvPairDataType.SECRET`)** — a private environment's `kvPairData` entry with this type is genuinely encrypted at rest and only decrypted at send-time, via the vault key infrastructure below (see "Vault Key" in `preferencesFlow`) — reading it back through `{{ _.vault.<name> }}` in a request field requires the current session to actually hold a working vault key (a `vaultKey` fixture override, or a live `generateVaultKey()`/`enterVaultKey()` call), not just `isPrivate: true` on the environment. `JSON`-typed entries render their raw text as-is, no special handling needed. Real example: `tests/environment/private-environment-secret-variable.spec.ts`.

**Legacy vault-format collections** — a collection imported from a legacy export can carry pre-existing Collection Environments/sub-environments whose values are already in the old vault tag's array/object shapes (`["a","b"]`, `{"k":"v"}`) rather than a plain scalar; both resolve correctly through `{{ _.vault.<name> }}` at send-time, while a scalar value under the reserved `vault` key throws (`"vault is a reserved key for insomnia vault"`) instead of silently working — use `environmentFlow.activate()` (not `link()`) to switch between an imported collection's own sub-environments in this scenario, since they're nested directly under the collection rather than being separate Project Environments. Real example: `tests/environment/vault-legacy-format-environment-variables/vault-legacy-format-environment-variables.spec.ts` (own directory since it carries a `.yaml` import fixture, per the fixture-file convention).

## `cookieFlow`

```ts
link<T extends CookieTarget>(item: T, cookies: Cookie[]): Promise<Cookie[]>  // returns the full cookie jar read back after setting, NOT `item`/`cookies` echoed as-is; reads it back via a private get() internally
// CookieTarget = Collection | HttpRequest | EventStreamRequest | GraphQLRequest | GrpcRequest | SocketIORequest | WebSocketRequest
```

`get(item: CookieTarget): Promise<Cookie[]>` also exists on `flows/cookie.flow.ts`, but is `private` — `link()` is the only public entry point a spec can call; there's no standalone way to read the jar without also setting it.

`Cookie`: `{ key: string; value: string; domain?: string; path?: string; expires?: Date | string | number; secure?: boolean; httpOnly?: boolean; hostOnly?: boolean; id?: string }`. Real example: `tests/cookie/happy-path.spec.ts` — note the linked list is used directly (`cookieList.filter(...)`), not via a `.cookies` property; `link()` no longer returns `item` merged with a `cookies` field, just the plain `Cookie[]` (it calls the private `get()` internally after setting).

`cookieFlow.link()` **does** branch on `documentId` (via `item.collection?.documentId`, or `item.documentId` when `item` is a Collection) — passing a Document's `document.collection`, or a request found inside one (its `collection` field must already be populated, e.g. by that request flow's own `create()`/`get()`), opens the Document's own Collection tab first instead of clicking the project navigation tree. Prefer calling `cookieFlow.link()` for a document-scoped request while still on/near its Collection tab (e.g. right after linking, before a stateful protocol's `connect`/`send`/`disconnect` moves the view to the Response pane) — reopening the Collection tab from the Response pane has shown a timing race that intermittently returns an empty cookie list.

**`link()` resets the whole jar, not just the target's cookies**: `CookiePage.setCookies()` calls `deleteAll()` before adding its list, so calling `link()` a second time (even against a _different_ request) wipes out cookies added by an earlier `link()` call in the same test. If a test needs more than one cookie present at once, pass them all in a single `link(target, [cookieA, cookieB, ...])` call rather than linking separately — the target passed in only matters for _where the Cookie Jar dialog gets opened from_, since the jar itself is shared workspace-wide.

**Confirmed real bug, fixed in place**: `link()`'s internal `waitForPersisted()` used to just poll the on-disk `insomnia.CookieJar.db` NeDB file and time out after 60s if a just-set cookie never showed up — under CPU-contended parallel runs (10 workers) that timeout was hit for real, at roughly a 1-in-10 rate on `tests/data/import/url/import-swagger-api.spec.ts`. A diagnostic probe (logging every poll's elapsed time and the file's mtime) proved this isn't a slow write that eventually lands — the file's mtime stops moving entirely the moment the write is lost, confirmed across 50+ polls spanning almost a minute. Root cause: `CookiePage.editCookie()` only waits `FIELD_SAVE_DELAY` (500ms) after the last field edit before clicking "Done", which unmounts the edit dialog; under contention the app's own debounced save can still be pending past 500ms, and the unmount cancels it — the cookie then never lands on its own. Fixed the same way `HttpRequestFlow.waitForUrlPersisted()` fixes the analogous URL-drop bug: `waitForPersisted()` now re-runs the whole open→setCookies→close write once per mismatch instead of passively waiting. Verified stable at `--workers=10 --repeat-each=15` across every spec that calls `cookieFlow.link()` (0 failures, vs. reproducible failures before the fix).

**Confirmed real behavior of the flags** (verified live against Insomnia 13.1.0, not assumed from spec text alone):

- `httpOnly: true` — only restricts JS (`document.cookie`) access; it has **no effect on whether the cookie is sent** over any scheme. Insomnia sends it over both `http://` and `https://`, which is spec-correct, not a bug. See `tests/cookie/http-only-cookie-always-sent.spec.ts`.
- `hostOnly: true` checks the edit dialog's "HostOnly" checkbox (`getByRole("checkbox", { name: "HostOnly" })`, same pattern as `secure`/`httpOnly`). A `__Host-`-prefixed `key` is silently dropped from outgoing requests (not an error, just absent from the sent `Cookie` header) unless `hostOnly: true` is also set, even when `domain`/`path`/`secure` are otherwise correct — confirmed live by linking the same `__Host-` key with and without `hostOnly` in the same jar. There is no way to read `hostOnly` back via `cookieFlow.link()`'s returned jar (or `CookiePage.getCookies()`): the list row's flattened cookie-line text (parsed by `parseCookieLine()`) never includes a `HostOnly` token the way it does for `Secure`/`HttpOnly`, so it's write-only through this layer. See `tests/cookie/host-prefix-cookie-requires-host-only.spec.ts`.
- `expires` set to a past date — the cookie is excluded from subsequent request sends (real enforcement), but still shows up in `cookieFlow.link()`'s returned jar (not purged from the jar, just not matched when building the `Cookie` header). See `tests/cookie/expired-cookie-not-sent.spec.ts`.
- `CookiePage.editCookie()`'s `expires` field is a native `input[type="datetime-local"]`, not a CodeMirror editor like the other fields — it's filled directly via `.fill("YYYY-MM-DDTHH:mm")` in local time, not through the shared `fillField()`/CodeMirror helper.

`pageManager.cookiePage.editCookieRaw(existingKey: string, rawCookieString: string): Promise<void>` — edits an already-listed cookie via the edit dialog's "Raw" tab in one shot (e.g. `"foo=bar; Domain=example.com; Path=/"`), instead of the structured per-attribute fields `setCookies()`/`editCookie()` use. No `CookieFlow` wrapper — the cookie list dialog must already be open (`cookiePage.open()`) since `cookieFlow.link()` closes it before returning. Real example: `tests/cookie/raw-cookie-string-editor.spec.ts`.

**Confirmed real bug, fixed in place**: `editCookieRaw()` used to click "Done" immediately after `.fill(rawCookieString)` with no `FIELD_SAVE_DELAY` wait at all (unlike `editCookie()`'s `fillField()`, which always waits one) — same debounce-cancelled-by-unmount race as the `link()` bug above, but with zero protection instead of a too-short 500ms window. Reproduced at a ~1-in-4 rate on `raw-cookie-string-editor.spec.ts` under `--workers=10 --repeat-each=15`: the read-back cookie silently kept its pre-edit value. Fixed by adding the same `FIELD_SAVE_DELAY` wait `fillField()` uses, right after the `.fill()` and before "Done" is clicked. Verified stable at the same `--workers=10 --repeat-each=15` load (0/15 failures after the fix).

## `organizationFlow`

Covers the "Invite collaborators" dialog, opened from the app header's own "Invite collaborators" button — invite by typed email or by picking an existing organization member from a search popover, and set/change a collaborator's role.

```ts
// OrganizationFlow (flows/organization.flow.ts)
invite(...collaborators: Collaborator[]): Promise<void>
// Collaborator = { email: string; role?: CollaboratorRole; existed?: boolean }
```

`invite()` does three things per entry, driven by which fields are set: a plain `{ email }` is typed into the invite form and confirmed as its own chip; `{ email, existed: true }` is instead added by searching `pageManager.invitePage.searchOrganizationMembers(email)` and clicking the matching result out of the "Organization members" popover; either way, every such entry gets submitted together in one `sendInvites()` call at the end (skipped entirely if nothing needed inviting). An entry carrying a `role` **without** `existed: true` is treated as already listed (e.g. changing an already-accepted member's role, not inviting anyone new) and is excluded from the invite step — only after inviting does `invite()` walk every entry that has a `role` (freshly invited or already-listed alike), read its current role back via `getMemberRole()`, and click through the role menu via `setMemberRole()` only if it doesn't already match, rather than always clicking through.

```ts
// pageManager.invitePage (pages/invite.page.ts)
open(): Promise<void>                              // clicks the header's "Invite collaborators" button, then navigate()
navigate(): Promise<void>                           // waits for the dialog and its "Invitation list" to render
addEmail(email: string): Promise<void>              // types into the email input, confirms via Enter as its own chip
searchOrganizationMembers(query: string): Promise<void>  // types into the same email input, waits for the "Organization members" popover's first result
selectOrganizationMember(email: string): Promise<void>   // clicks the popover result matching email — call searchOrganizationMembers() first
sendInvites(): Promise<void>                        // closes the popover (Escape) and clicks the dialog's "Invite" button
getInvitationCount(): Promise<number>               // row count in the "Invitation list" (accepted members + pending invites together)
getInvitations(): Promise<Invitation[]>             // Invitation = { email, role: CollaboratorRole, status: "Member" | "Invite sent" }
isInvited(email: string): Promise<boolean>
getMemberRole(email: string): Promise<CollaboratorRole>
setMemberRole(email: string, role: CollaboratorRole): Promise<void>  // opens that row's role menu and selects role
```

**Confirmed live DOM detail**: the "Organization members" search popover is a React Aria `Popover` that portals outside the "Invite collaborators" dialog's own DOM subtree, so `InvitePage` locates it from `this.page` directly (`getByLabel("Organization members")`) rather than scoped under the dialog — keep that in mind if a new `InvitePage` method needs to reach into it. The email input's placeholder also switches from `"Enter emails, separated by comma..."` to `"Enter more emails..."` once at least one chip exists, matched by a regex covering both.

Real example: `tests/organization/invite-collaborators.spec.ts` — invites one brand-new email plus five existing organization members (picked via search) in a single `invite()` call, then changes an already-listed member's role to `CollaboratorRole.Admin` in the same call, and asserts `getInvitationCount()` grew by exactly the number of invitees (not the role-only change) via `expect.poll()`.

## `certificatesFlow`

Covers the workspace-wide "Manage Certificates" dialog (CA Certificate + Client Certificates), reached via a Collection's own toolbar "Certificates"/"Certificates (N)" button — the same toolbar `cookieFlow` reaches "Cookies" from, sitting right next to it. Shares `cookieFlow`'s exact `openTarget()` navigation pattern (own copy, `CertificateTarget`, not a re-exported `CookieTarget`).

```ts
setCaCertificate(item: CertificateTarget, path: string): Promise<void>       // uploads path as the workspace's single CA Certificate (overwrites any existing one)
addClientCertificate(item: CertificateTarget, certificate: ClientCertificate): Promise<void>
setClientCertificateEnabled(item: CertificateTarget, host: string, enabled: boolean): Promise<void>
// CertificateTarget = Collection | HttpRequest | EventStreamRequest | GraphQLRequest | GrpcRequest | SocketIORequest | WebSocketRequest
```

`ClientCertificate` (`models/certificate.ts`): `{ host: string; cert: string; key: string; passphrase?: string }` — `cert`/`key` are absolute paths to PEM files, uploaded via the "Add Client Certificate" form's default "Certificate" tab. The form's other tab ("PFX or PKCS12", a single combined-file alternative to separate cert+key) is NOT covered — unconfirmed live, no model field for it.

```ts
// pageManager.certificatesPage — direct access, e.g. to add a certificate without a Flow round-trip
open() / close(): Promise<void>                          // via the Collection toolbar's "Certificates" button / the dialog's "Done" button — item must already be navigated to (see CertificatesFlow's openTarget pattern)
addCaCertificate(path: string): Promise<void>
addClientCertificate(certificate: ClientCertificate) / setClientCertificateEnabled(host, enabled): Promise<...>
// getCertificatesCount()/removeCaCertificate()/removeClientCertificate() (page) and setCaCertificateEnabled() (page + Flow)
// were removed as dead code (no test ever called them) — re-add a public method there if a future test needs to read the
// toolbar badge count, toggle the CA certificate on/off, or remove a certificate.
```

**Confirmed live, non-obvious DOM structure** — both file pickers ("Add CA Certificate", and "Add certificate file"/"Add key file" inside "Add Client Certificate") are plain native `<input type="file">` elements, set directly via Playwright's `setInputFiles()` — NOT Electron's `dialog.showOpenDialog`, so no `BasePage.stubFileChooser()` needed here (unlike Git Sync's `chooseCloneLocation()`). The "Manage Certificates" overlay renders as two elements both carrying `role="dialog"`; `CertificatesPage` scopes by `.filter({ hasText: "Manage Certificates" }).first()`, not `getByRole("dialog", { name: ... })`, since only that outer element's subtree actually contains the certificate list content. Within it, the **CA Certificate is a plain `<div>`** (not a `role="row"` grid item — it's a single global setting, not a list), located structurally as the sibling immediately following its own description `<p>`; **Client Certificates genuinely are `role="row"` grid items**, one per host, located by `hasText: host` alone (sufficient since hosts are unique per test — a `.filter({ has: ... })` co-filter on the toggle's `[data-test-id="client-certificate-toggle"]` was tried and, despite confirmed-live DOM containment, never matched through Playwright's `has` filter for reasons not root-caused; dropped rather than shipped unreliable). The toggle and the dialog's close button are both located by accessible role/name instead (`row.getByRole("button", { name: /^(Enabled|Disabled)$/ })`, `dialog.getByRole("button", { name: "Done" })`) — `pages/certificates.page.ts` has no `data-test-id`/`data-testid` locators at all, unlike `import.page.ts`'s `[data-test-id="..."]` CSS-locator convention.

**Confirmed live gotcha — client cert files need the same allowlist as the `file` template tag**: `addClientCertificate()`'s `cert`/`key` paths are read by curl at send time, not embedded at add time (unlike the CA certificate, which works with no allowlisting) — without `preferencesFlow.set({ dataFolders: [<the containing folder>] })` first, the send silently fails with `"Insomnia cannot access the file '<path>'..."` landing in `response.console` (HTTP) with `statusCode` left `undefined`, same shape as the mTLS-rejection case below, so a missing allowlist can masquerade as "the mTLS enforcement itself failed" if you don't check the console text.

**Confirmed live — how an mTLS/CA failure actually surfaces differs by protocol, neither one throws a generic error you can `.rejects.toThrow()` blindly**:

- **HTTP** (`HttpRequestFlow.send()`): a TLS handshake failure (missing/wrong client cert, untrusted CA) does **not** reject — curl's own error lands as plain text inside the resolved `Response.console` (e.g. `"...alert certificate required..."` or `"...unable to get local issuer certificate..."`), with `Response.statusCode` left `undefined`. Assert on `response.statusCode`/`response.console`, not `.rejects`.
- **gRPC** (`GrpcRequestFlow.create()`/`.send()`): a client-cert-required failure surfaces as a real error dialog ("Client Certificate Required — The server requires a client certificate to establish a connection.") — but confirmed live, it fires during **`create()`'s "Apply Request Fields" step** (the app appears to probe the connection when the URL/method are set), not `send()`. Assert with `await expect(grpcRequestFlow.create(...)).rejects.toThrow(/Client Certificate Required/)`. The popped dialog is **not** auto-dismissed by `@throwOnDialog` (it only detects+throws, per `misc/decorators.ts`) — `await user.page.keyboard.press("Escape")` is needed before any further UI interaction in the same test (e.g. before opening "Manage Certificates" again to add the fix).

Real examples: `tests/http-request/mtls-client-certificate.spec.ts` (client-cert toggle controls enforcement — fails/succeeds/fails again), `tests/http-request/custom-ca-root-certificate.spec.ts` (`setCaCertificate()` establishes trust with `validateSSL` never touched), `tests/grpc-request/mtls-client-certificate.spec.ts` (same toggle-controls-enforcement shape as the HTTP one, via `create()`'s rejection instead of `send()`'s).

## `folderFlow`

Folders didn't exist in this framework at all until the OAuth2 Auth-tab work needed one for the "inherited authentication" scenario — built from scratch, mirroring `HttpRequestFlow.create()`'s own shape.

```ts
create(parent: Collection | Folder, folder: Folder): Promise<Folder>   // right-click parent -> ContextMenuItem.Folder ("New Folder") -> names it via the PROMPT_INPUT dialog (workspace.setItemName(), NOT setNewItemName() — see gotcha below) -> clickCreate()
open(folder: Folder): Promise<FolderPage>                       // right-click folder -> ContextMenuItem.OpenInNewTab -> returns pageManager.folderPage once its pane is visible
fetchOAuth2Tokens(folder: Folder): Promise<OAuth2Tokens>        // open(folder) + page.fetchOAuth2Tokens() + page.getOAuth2Tokens() in one call — see Authentication below
// get(name) (findItemNode({ name }, TreeNodeType.Folder)) is private — only create() re-fetches through it after creation
```

`Folder` (`models/folder.ts`): `{ name: string; id?: string }` — deliberately minimal, no fields beyond identity; set its Auth/Headers/etc. via `pageManager.folderPage` (an `AuthTabPage`) after `open()`, not through `create()`'s params.

**Confirmed live, non-obvious behavior**:

- A Folder's own **"Settings"** context-menu item opens a plain rename/move dialog ("Folder Settings" — Name field + "Move/Copy to Workspace") — it is **not** the same as a request's tabbed editor. To reach the Auth/Headers/Scripts/Environment/Docs tabs, use **"Open in New Tab"** instead (`ContextMenuItem.OpenInNewTab`), which opens the exact same tab-bar component a request uses (confirmed live: `["Auth", "Headers", "Scripts", "Environment", "Docs"]`), just without the `data-testid="request-pane"` wrapper a request's own pane carries — `FolderPage.PANE` is `'div:has(> [aria-label="Request pane tabs"])'` instead, a structural selector rather than a testid.
- The "New Folder" naming dialog's input is `input#prompt-input` (same one `WorkspacePage.setItemName()` already targets for renaming), **not** `input[name="name"]` (`setNewItemName()`'s selector, used by Collection/Document creation) — using the wrong one hangs waiting for an input that isn't there.
- `WorkspacePage.waitForFirstRealChild()` had a **real pre-existing bug**, surfaced by Folders specifically: it only recognized the `"emptyCollection"` placeholder-child name, not a Folder's own `"emptyFolder"` — fixed to `children[0]?.name?.startsWith("empty")` (with `?? true` so a still-empty children array keeps polling instead of throwing).
- Every per-domain request flow's `create()` (and `FolderFlow.create()` itself, for nested folders) types `parent` as `Collection | Folder` — pass a `Folder` directly (`httpRequestFlow.create(folder, {...})`) to create a request as the folder's child, no cast needed; `resolveNode()`/`findItemNode()` don't filter by node type when an `id` is present, so this "just works" against the real folder tree node.

Real example: `tests/http-request/oauth2-folder-inherited-auth.spec.ts` — creates a Folder, configures OAuth 2.0 Client Credentials on `folderPage`, fetches its tokens, creates a child request with `AuthType.Inherit`, and asserts `send()`'s outgoing `Authorization` header matches the folder's token.

## `preferencesFlow`

```ts
set(settings: Settings): Promise<Settings>   // opens Preferences, applies each defined field, closes
```

Not a domain flow (no CRUD) but does have a Model — `models/settings.ts`'s `Settings` class wraps the app-wide `Settings` fields, one property per simple (boolean/string/number) field, plus two synthetic composite fields (`aiUrlBackend`, see below; `cloudCredentials`, see "Cloud (Vault) Credentials" below) that aren't real `AppSettings` members. Follows the Model-stays-in-the-flow convention above: `PreferencesFlow.set()` dispatches field-by-field itself, calling a plain per-field `PreferencesPage` setter (e.g. `setValidateSSL`) only for properties defined on the passed `Settings`. `Settings` currently declares `validateSSL`, `dataFolders`, `templateTagSandboxEnabled`, `filterResponsesByEnv`, `timeout`, `proxyEnabled`, `httpProxy`, `httpsProxy`, `noProxy`, `sidebarFocusForCollections`, `aiUrlBackend`, and `cloudCredentials` — add more fields to `models/settings.ts` plus a matching `PreferencesPage` setter + `PreferencesFlow.set()` branch the same way if a test needs another Settings toggle. Complex (array/object-typed) `Settings` fields like `hotKeyRegistry`/`pluginConfig` are intentionally out of scope. **`sidebarFocusForCollections` defaults to `false` in the `user` fixture** (the installed app itself now defaults it `true`, which auto-narrows the sidebar and breaks unrelated specs — see the Sidebar keyboard navigation section above) — a spec that wants focus mode turns it back on itself via `preferencesFlow.set({ sidebarFocusForCollections: true })`.

**`set()` returns a `Settings`, not `void`** — for most fields there's nothing to read back (`return new Settings({ aiUrlBackend: ... })` only ever populates the one field it actually re-visited), so every other caller can just ignore the return value the same way they always have. It exists specifically so `aiUrlBackend` callers never need to touch `pageManager.preferencesPage` directly — see below.

Needed whenever a test must hit an HTTPS URL with an untrusted/self-signed cert (`Settings.validateSSL` defaults to `true` and Insomnia rejects the cert otherwise) — e.g. before sending to `misc/echo-server.js`'s HTTPS port (see Mock servers below). Call it once per test, before any request that needs it:

```ts
await preferencesFlow.set({ validateSSL: false });
```

(No `Settings` import needed for this — the plain object literal is enough; see the Model-literal convention above.)

Non-obvious UI fact baked into `PreferencesPage`: the "Validate certificates" checkbox is a custom-styled control whose native `input[type="checkbox"]` ignores direct clicks/`.check()` — the wrapping `<label>` is the actual clickable target (same quirk for `proxyEnabled`/`filterResponsesByEnv`). Also, the Preferences dialog's own ARIA role name is a generic `"Modal"` shared by every modal in the app, so `PreferencesPage` scopes it by visible heading text (`"Insomnia Preferences"`) instead of by role name. Real example: `tests/cookie/secure-cookie-not-sent-over-http.spec.ts`, `tests/cookie/http-only-cookie-always-sent.spec.ts`.

`timeout` (General tab, "Request timeout (ms)") is also the timeout that governs pre-request/after-response script execution — see `AppFlow`'s hidden-window notes below. `proxyEnabled`/`httpProxy`/`httpsProxy`/`noProxy` (any one of the four opens the Proxy tab) route outgoing requests through a configured proxy; real example: `tests/preferences/proxy-settings.spec.ts` (asserts the timeline console shows `"Trying <proxy-host>"` via `responsePage.getConsole()` even though nothing is listening at that address). `filterResponsesByEnv` real example: `tests/preferences/filter-responses-by-environment.spec.ts`.

### AI Settings — "url" backend (Preferences → AI Settings tab, `tests/preferences/ai-backend-settings.spec.ts`)

Configured and activated entirely through the real UI form — no `window.main.llm` bridge call involved — via `Settings.aiUrlBackend` in `preferencesFlow.set()`. Both directions go through `set()`; a caller never needs `pageManager.preferencesPage` for this:

```ts
const afterActivate = await preferencesFlow.set({
  aiUrlBackend: { url, model, apiKey, temperature, topP, maxTokens }, // configure + activate — apiKey/temperature/topP/maxTokens all optional
});
// afterActivate.aiUrlBackend: AiUrlBackendSettings — the real form's fields read straight back, plus isActive: true

// ...later, to deactivate (keeps the stored config, only clears the active-backend pointer):
const afterDeactivate = await preferencesFlow.set({ aiUrlBackend: null });
// afterDeactivate.aiUrlBackend: the same fields (read *before* clicking Deactivate, i.e. straight after
// Preferences reopens — proving the config survived the previous call's close) plus isActive: false
```

`models/settings.ts`'s `AiUrlBackendSettings` interface is the shared shape for both input and output — `isActive` is read-back only (ignored on input; configuring always activates, deactivating is only reachable via `aiUrlBackend: null`).

The real form's flow (all internal to `set()`'s `aiUrlBackend` branch): click the "LLM URL" nav button -> fill "LLM URL"/"API Token" -> click "Load Models" (a genuine `fetch(<url>/models)`, so it needs a mock endpoint to hit — see `MOCK_LLM_SERVER` below) -> select a model from the resulting `<select>` -> optionally expand Advanced Options and fill Temperature/Top P/Max Tokens -> click "Activate" (disabled until a model is selected). Deactivating reads the panel's fields via `PreferencesPage.getUrlBackendFormValues()` first, then clicks "Deactivate", then polls `isAiBackendActive()` down to `false` before `set()` returns.

`misc/fixtures.ts`'s `MOCK_LLM_SERVER` (`${MOCK_API_SERVER}/mock-llm`) is a fake LLM endpoint whose only implemented route is `GET /mock-llm/models` (`misc/mock-api.js`, static `ROUTES` entry), returning two fixed model ids (`"mock-llm-model-1"`, `"mock-llm-model-2"`) in the OpenAI-compatible `{ data: [{ id, object: "model" }] }` shape "Load Models" expects — pass one of those two ids as `model`.

The underlying `PreferencesPage` primitives `set()` composes (only reach for these directly if a test needs a scenario `set()` doesn't cover, e.g. an invalid-PAT-style rejection path):

```ts
pageManager.preferencesPage.openAiSettingsTab(): Promise<void>
pageManager.preferencesPage.isAiBackendActive(navLabel: string): Promise<boolean>              // e.g. isAiBackendActive("LLM URL") — checks for a "<navLabel> Active" nav button
pageManager.preferencesPage.getUrlBackendFormValues(navLabel: string): Promise<LlmUrlBackendFormFields>  // e.g. "LLM URL" or "LLM URL Active" — expands the panel and reads back { url, model, apiKey, temperature, topP, maxTokens } (strings, straight from the inputs/select)
```

Confirmed live gotchas:

- The AI Settings tab itself is only rendered once the bundled AI plugin exists and the user is logged in (always true for this project's fixture).
- `navLabel` is the backend's nav button's accessible name, e.g. `"LLM URL"` before anything's configured or `"LLM URL Active"` once it's the active backend — still needs an explicit click even though the panel already defaults to the active backend on mount.
- **The Preferences modal isn't remounted on every open/close** — local component state (including the AI Settings panel's own) can survive a full `close()`/`open()` cycle. Two consequences already hit and fixed inside the Page layer, not left for callers to work around: `openAiAdvancedOptions()` now checks visibility before clicking (an unconditional click could collapse an already-open panel instead of opening it), and `getUrlBackendFormValues()` polls past a transient empty "LLM URL" read (some hydration still happens async on reopen, even though the component isn't fresh) rather than racing it — confirmed by reading the same config straight from `window.main.llm.getAllConfigurations()` while the UI still showed blanks.
- The "Model" field isn't always a `<select>` — an already-active backend that hasn't had "Load Models" clicked in the current render pass instead shows a plain "Active model: `<name>`" text row with a "Change" button. `getUrlBackendFormValues()` handles both forms internally (a private `ensureModelSelectorVisible()` clicks whichever of "Load Models"/"Change" is present) — don't assume `getByLabel("Model")` is always there.
- `Activate` stays disabled until a model has been explicitly selected from the "Load Models" dropdown, even if that model was already the active one before — `set()` always re-selects it after `clickLoadAiModels()`.
- Deactivation's "Active" badge clears asynchronously — `set()` polls `isAiBackendActive()` down to `false` with `.toPass()` before returning, rather than trusting a single post-click read.
- A `PreferencesFlow` helper method that isn't itself a UI step (e.g. a plain data-shaping function like the private `toAiUrlBackendSettings()`) must be added to `misc/step-instrumentation.ts`'s `EXCLUDED_METHODS` — otherwise `instrumentWithSteps()` wraps it into an async step function too, and calling it without `await` silently assigns a `Promise` instead of its real return value.

### Cloud (Vault) Credentials (Preferences → Credentials tab, `tests/template-tag/external-vault-credentials.spec.ts`)

Creates the AWS/GCP/HashiCorp cloud-service credentials a `vault` template tag resolves against, entirely through `Settings.cloudCredentials` in `preferencesFlow.set()` — a caller never needs `pageManager.preferencesPage` directly for this:

```ts
await preferencesFlow.set({
  cloudCredentials: [
    { provider: "aws", name, credentials: { type: AWSCredentialType.file, section, region } },
    { provider: "gcp", name, credentials: { serviceAccountKeyFilePath } },
    { provider: "hashicorp", name, credentials: { type: HashiCorpCredentialType.onPrem, authMethod: HashiCorpVaultAuthMethod.appRole, serverAddress, role_id, secret_id } },
  ],
});
```

`CloudCredential` (`models/settings.ts`) is a discriminated union tagged by `provider: "aws" | "gcp" | "hashicorp"`, each `credentials` field reusing the app's own real per-provider shape from `insomnia-data/src/models/cloud-credential` (`AWSFileCredential`/`GCPCredential`/`VaultAppRoleCredential` — import `AWSCredentialType`/`HashiCorpCredentialType`/`HashiCorpVaultAuthMethod` from that same module for the literal fields) rather than redefining them — deliberately narrowed to just the one auth mode each provider has a create method for (AWS: "Credential File", not temporary/SSO; HashiCorp: on-prem AppRole). `azure` is left out entirely — its credential only ever comes from a real OAuth redirect, so there's no create method for it.

```ts
// PreferencesFlow — the per-provider create methods set() dispatches to, if a test needs one standalone
createAwsCloudCredential(credential: Omit<AwsCloudCredential, "provider">): Promise<void>
createGcpCloudCredential(credential: Omit<GcpCloudCredential, "provider">): Promise<void>
createHashiCorpCloudCredential(credential: Omit<HashiCorpCloudCredential, "provider">): Promise<void>
// each: Preferences -> Credentials tab (must already be open, see openCredentialsTab()) -> "Create Cloud
// Credential" -> the provider's own "Authenticate With <Provider>" modal -> fills the name + provider
// fields -> "Create" -> waits for the modal to close
```

Under this app's `PLAYWRIGHT=true` launch env, `@kong/insomnia-plugin-external-vault`'s own `authenticate` action short-circuits to a canned success without ever calling the real AWS/GCP/HashiCorp API — so every field above only needs to be well-formed (a real-looking region/URL/non-empty string), not a genuine credential. Once created, a credential is selected by name from a `vault` tag's own "Credential For Vault Service Provider" argument — see `templateTagFlow.edit()`'s `vault` branch below. Real example: `tests/template-tag/external-vault-credentials.spec.ts` (all three providers, plus resending the same request a second time to confirm the resolved secret is stable, not a one-shot value).

### Vault Key (Preferences → General tab, Security section — `tests/preferences/vault-key-generation.spec.ts`, `tests/preferences/vault-key-reset-and-invalid-key.spec.ts`)

Generates, unlocks, and resets the local key that gates a private environment's Secret-typed variables (`EnvironmentKvPairDataType.SECRET`, see `environmentFlow` above) — entirely through `preferencesFlow`, no `Settings` field involved since a vault key isn't an `AppSettings` member either. It's a genuinely different mechanism from `Settings` — reads/generates real key material, not a scalar toggle:

```ts
// PreferencesFlow
generateVaultKey(): Promise<string>          // Preferences -> General tab's "Generate Vault Key" -> reads back the freshly-generated key -> closes. Only shown when no vault salt exists yet for this session.
enterVaultKey(key: string): Promise<string | null>
  // opens the "Enter Vault Key" modal, submits `key` -> closes. Requires a vault salt to already
  // exist (e.g. via the `vaultSalt` fixture override below). Returns the modal's own validation
  // error text if `key` is rejected (the modal stays open, so there's no dialog to `.rejects.toThrow()`),
  // or `null` on success.
resetVaultKey(): Promise<string>
  // opens the "Enter Vault Key" modal, clicks its own "Reset Vault Key" confirm button, reads back
  // the freshly-generated replacement key -> closes. Also requires a vault salt to already exist.
```

```ts
// pageManager.preferencesPage — lower-level access, if a test needs a step set()'s wrappers don't expose
getVaultKey(): Promise<string>                        // reads the General tab's currently-displayed key, once already unlocked
openEnterVaultKeyModal() / fillVaultKeyInput(key) / clickUnlockVaultKey() / closeEnterVaultKeyModal(): Promise<...>
waitForVaultKeyUnlockOutcome(): Promise<string | null>  // polls a just-clicked Unlock to its final outcome — modal closing (accepted) or its error text settling (rejected)
resetVaultKeyFromModal(): Promise<string>              // the "Reset Vault Key" confirm + read-back + dismiss sequence enterVaultKey()/resetVaultKey() build on
```

**Seeding vault state without the real UI flow** — `misc/fixtures.ts` exposes `vaultKey`/`vaultSalt` as their own overridable fixtures (empty string by default, meaning "no vault key/salt ever generated", same as every other spec), seeded straight into the renderer at launch via `INSOMNIA_VAULT_KEY`/`INSOMNIA_VAULT_SALT` (plus `PLAYWRIGHT_TEST`, auto-set whenever `vaultKey` is non-empty — it's what makes `decryptVaultKeyFromSession()` return the seeded key verbatim instead of trying to decrypt it as real Electron `safeStorage` ciphertext):

```ts
const testWithVaultKey = test.extend({
  vaultKey: async ({}, use) => {
    const jwk = { alg: "A256GCM", ext: true, k: crypto.randomBytes(32).toString("base64url"), key_ops: ["encrypt", "decrypt"], kty: "oct" };
    await use(Buffer.from(JSON.stringify(jwk), "utf8").toString("base64"));
  },
  vaultSalt: async ({}, use) => use(crypto.randomBytes(32).toString("hex")),
});
```

Use `vaultKey` (+ matching `vaultSalt`) to pre-unlock the vault for a scenario that only needs to _read_ an already-encrypted Secret variable (skips the real generate/enter-key UI entirely); use `vaultSalt` alone (no `vaultKey`) to land Preferences' Vault Key panel on "Enter Vault Key" instead of "Generate Vault Key", for a scenario that specifically exercises `enterVaultKey()`/`resetVaultKey()` against a pre-existing salt. `misc/mock-api.js` backs this with a **real SRP exchange** (`@getinsomnia/srp-js`, the same package/version the app itself uses) against `/v1/user/vault(/reset)`/`vault-verify-a`/`vault-verify-m1` — an incorrect vault key genuinely fails server-side `checkM1()`, not a canned rejection — isolated per session the same way Cloud Sync's mock state is; the `insomnia` fixture calls `resetVaultState()` before every launch so one test's generated/reset key never leaks into the next test on the same worker. Real examples: `tests/preferences/vault-key-generation.spec.ts`, `tests/preferences/vault-key-reset-and-invalid-key.spec.ts` (both fixtures in combination), `tests/environment/private-environment-secret-variable.spec.ts` and `tests/environment/vault-legacy-format-environment-variables/vault-legacy-format-environment-variables.spec.ts` (`vaultKey` pre-seeded to read a Secret variable back at send-time).

### Konnect sidebar sync (`tests/konnect/`)

No Flow — call `user.pageManager.konnectPage` directly, same pattern as `commandPalettePage`. Configuring a PAT hits the real Konnect API surface at `KONNECT_API_URL` (`misc/fixtures.ts` already points this at `MOCK_API_SERVER`), whose `GET /v2/control-planes` route `misc/mock-api.js` already stubs to return `{ data: [] }` — any non-empty string is accepted as a "valid" PAT with no further mock-server work needed.

```ts
pageManager.konnectPage.navigate(): Promise<void>                    // waits for the sidebar tab to be visible
pageManager.konnectPage.isTabVisible(): Promise<boolean>             // false once konnectSync org feature flag is disabled
pageManager.konnectPage.openTab(): Promise<void>
pageManager.konnectPage.openProjectsTab(): Promise<void>
pageManager.konnectPage.isIntroCardVisible(): Promise<boolean>       // "Auto-sync your gateway service routes" — shown only pre-PAT
pageManager.konnectPage.clickConfigure(): Promise<void>
pageManager.konnectPage.setPat(pat: string): Promise<void>
pageManager.konnectPage.clickConnectAndSync(): Promise<void>         // waits for the settings modal to close itself — confirmed live: PAT validation + org-id fetch are async, so reading isSettingsModalOpen() immediately after the click would still see it open without this wait
pageManager.konnectPage.isSettingsModalOpen(): Promise<boolean>
pageManager.konnectPage.isSyncButtonVisible(): Promise<boolean>      // only rendered while the Konnect tab itself is active (`!isProjectTabActive`) — switching to Projects unmounts it, so read this *before* `openProjectsTab()`; also confirmed live to lag slightly after connecting, needs `expect.poll(...)`, not a bare read
```

`misc/mock-api.js`'s `konnectSync` org-feature flag is mutable the same way Git Sync's flags are — `misc/fixtures.ts`'s `setKonnectSyncFeatureFlag(enabled)` toggles `PUT /_admin/features/konnect-sync`. Unlike Git Sync's flags, confirmed live that a plain `user.page.reload()` (no app relaunch) is enough to pick up the new value mid-session — no `beforeAll`/pre-launch requirement. **Don't pass `{ waitUntil: "networkidle" }`**: confirmed live it can never resolve on the organization/project route, since the app keeps a real-time team-updates SSE connection open there (`insomnia-event-source://v1/teams/{orgId}/streams`) that never goes idle — the default `waitUntil: "load"` plus the existing `expect.poll(...)` on the UI state already covers the app's async re-render. Real examples: `tests/konnect/configure-and-sync.spec.ts`, `tests/konnect/hidden-via-feature-flag.spec.ts`.

### Plugins & Script Sandbox (Preferences → Plugins / Scripting tabs)

No separate `PluginsPage` — folded into `PreferencesPage`/`PreferencesFlow`, same as Credentials/Data. `AppFlow.getDataPath()` is enough to seed a custom plugin — write `package.json` (`{ name: "insomnia-plugin-<name>", insomnia: { name: "<name>" }, main: "main.js" }`) + `main.js` (`module.exports.templateTags`/`.requestActions`) directly into `<dataPath>/plugins/insomnia-plugin-<name>/`, then call `preferencesPage.reloadPlugins()` to pick it up — no fixture change needed.

```ts
preferencesFlow.createPlugin(name: string): Promise<void>                                   // Plugins tab -> "New Plugin" -> Generate; rejects with the validation error as an Error if the name is refused, else completes normally — assert a refused name with `.rejects.toThrow(...)`
preferencesFlow.toggleScriptSandboxRule(group: ScriptSandboxRuleGroup, enabled: boolean): Promise<void>
preferencesFlow.getInstalledPlugins(): Promise<string[]>                                    // opens Plugins tab, reads user-installed insomnia-plugin-* names, closes — wraps PreferencesPage.getPluginNames(); does NOT include bundled plugins (see getBundlePlugins() below)

pageManager.preferencesPage.reloadPlugins(): Promise<void>                                   // page.evaluate(window.main.plugins.reloadPlugins()) — no dialog needed
pageManager.preferencesPage.getRegisteredTemplateTagNames(): Promise<string[]>
pageManager.preferencesPage.getPluginBridgeMetrics(): Promise<PluginBridgeMetrics>            // { windowStartups, windowCrashes, pendingInvocations, perMethod: { [method]: { ok, error, timeout, ...durations } } }
pageManager.preferencesPage.executeRequestAction(label: string, requestId: string): Promise<void>  // rejects with the plugin action's own thrown error, if any
pageManager.preferencesPage.getPluginNames(): Promise<string[]>
pageManager.preferencesPage.isScriptSandboxRuleEnabled(group: ScriptSandboxRuleGroup): Promise<boolean>  // read-only; must already have Preferences open on the Scripting tab (openScriptingTab()) — no Flow wrapper, to avoid a same-named method shadowing the Page one across layers
pageManager.preferencesPage.getBundlePlugins(): Promise<BundlePluginInfo[]>  // window.main.plugins.getBundlePlugins() — the app's built-in (non-user-installed) plugins; doesn't require Preferences to be open
```

```ts
// WorkspaceFlow.generateCode()'s options.target/.client (see workspaceFlow section above) drive
// WorkspacePage's underlying dropdown methods directly, if a test needs them without going through generateCode():
pageManager.workspacePage.setGenerateCodeTarget(target: string): Promise<void>  // e.g. "Node.js" — must already have the "Generate Client Code" dialog open; no-ops if target is already selected
pageManager.workspacePage.setGenerateCodeClient(client: string): Promise<void>  // e.g. "Axios" — options depend on the currently-selected target; no-ops if client is already selected
```

Confirmed live (do not re-derive from upstream Kong/insomnia source without re-checking against the actually-installed app):

- `executeAction()` needs a `type: "request"` field merged into the action object from `getRequestActions()` (which doesn't carry one itself): `executeAction({ ...action, type: "request" }, { activeRequest: { _id } })`.
- The "New Plugin" modal's error field always shows a static hint (`"Plugin name must be of format my-plugin-name"`) before submit; `PreferencesPage.waitForNewPluginOutcome()` polls past it rather than racing the async update. Real messages: path traversal → `"...must not contain path traversal characters"`; emoji/spaces/most illegal chars → `"...must be lowercase, alphanumeric, and dash-separated"`. A single-char name is accepted (no minimum length).
- The "New Plugin" modal's own close button has no accessible name — `closeNewPluginModal()` uses `Escape`, not a role-based click (that would hit the underlying Preferences dialog's close button instead).
- `Settings.templateTagSandboxEnabled` (`toggle-plugin-sandbox` switch — labeled "Sandbox all plugin code (experimental)"; not `toggle-template-tag-sandbox`, which doesn't exist in the DOM) genuinely changes where a plugin template tag executes — off runs in the main/renderer process, on runs in the QuickJS sandbox; observable by having a tag self-report via `typeof process.binding` and rendering it into a header read back from the echo server.
- **Generate Code target/client switch — confirmed real and built.** The dialog's two `DropdownButton`s (target language, then client library — the second's options depend on the first) are plain react-aria menus whose items render with `role="menuitem"` (not `menuitemradio`/`combobox` — don't assume ARIA-radio semantics). Clicking a `DropdownButton`'s inner `<button>` needs `{ force: true }` (a bare click can silently no-op with `aria-expanded` staying `false`). **The snippet re-renders asynchronously (~1s) after picking a menu item** — `WorkspacePage.setGenerateCodeTarget()`/`.setGenerateCodeClient()` capture the CodeMirror text beforehand and poll until it changes, rather than a fixed sleep. Node.js's client list is HTTP/Request/Unirest/Axios/Fetch (still no node-libcurl, confirming the earlier gap-report correction); Python's default client (no explicit selection) is `http.client`, not `requests`. Both setters read the `DropdownButton`'s current label first and no-op (skip the click/poll entirely) if it already matches the requested value — safe to call even when the target/client is already selected.
- **Bundled plugins — confirmed real and built, but distinct from what the gap report guessed.** `getBundlePlugins()` (not a UI path) returns this project's two actual bundled plugins — `@kong/insomnia-plugin-external-vault` and `@kong/insomnia-plugin-ai` — each with `{ name, description, version, directory, config: { disabled }, permissions: { modules, capabilities }, permissionWarnings, permissionsDeclared }`. They never appear in `getPluginNames()`'s Preferences → Plugins tab list (that list is user-installed plugins only). **Correction of an earlier gap-report guess**: Preferences → Credentials' "Create Cloud Credential" button (used by `createAwsCloudCredential()`/`createGcpCloudCredential()`/`createHashiCorpCloudCredential()`, see the Cloud (Vault) Credentials section below) is exactly `@kong/insomnia-plugin-external-vault`'s own UI surface — it just isn't reachable from `getBundlePlugins()`/`getPluginNames()` either, since neither call is scoped to a specific bundled plugin's contributed UI.
- **Permission-manifest fields exist but are purely descriptive — confirmed NO runtime enforcement, so don't test them as a security boundary.** A plugin's `insomnia.permissions: { modules, capabilities }` in its `package.json` round-trips verbatim into `getPlugins()`/`getBundlePlugins()`'s `permissions` field, and `permissionsDeclared` flips `true` once any `permissions` key is present — but `permissionWarnings` was confirmed live to stay `[]` under every input tried (a valid module name, a nonexistent module name, a nonexistent capability name, or omitting the field entirely), and a plugin that never declares `modules: ["fs"]` can still `require('fs')` and have it execute successfully with no error/warning either way. Scenario 5 from the original gap report ("response body-path permission-scope security boundary") was descoped for this reason — there is no enforced boundary to assert against in the current app build.

Real examples: `tests/plugin/plugin-bridge.spec.ts`, `tests/plugin/plugin-name-validation.spec.ts`, `tests/plugin/template-tag-sandbox-execution-context.spec.ts`, `tests/plugin/script-sandbox-rule-toggles.spec.ts`, `tests/plugin/context-menu-action-registration/collection-context-menu-action.spec.ts` + `request-context-menu-action.spec.ts` (a `requestActions` entry's dynamically-labeled context-menu item — triggered via `workspacePage.clickItemContextMenu()`, see the "Sidebar filter, pin, inline rename, right-click" section above), `tests/plugin/bundled-plugins.spec.ts`, `tests/http-request/generate-code-target-client-switch.spec.ts`.

## `importFlow`

```ts
importCurl(project: Project, collection: Collection, curl: CurlCommand): Promise<void>   // curl = { command: string }
importClipboard(project: Project, content: string): Promise<void>                        // content = raw text (e.g. WSDL) pasted from clipboard
importFile(project: Project, filePath: string): Promise<void>                            // absolute/joined path to a fixture file
importUrl(project: Project, url: string): Promise<void>                                  // URL Insomnia fetches the spec from
importMcp(project: Project, url: string): Promise<void>                                  // MCP server URL to introspect
```

All of them import into the given `project`; `importCurl` additionally targets a specific `collection`. After import, resolve the resulting nodes via `workspaceFlow`/the relevant domain's `get()`, or `pageManager.workspacePage.getNodes()`. Real examples: one per source under `tests/data/import/{file,url,curl,clipboard,mcp}/`.

## `exportFlow`

Covers exporting a Collection/Project/all-data to disk. A single overloaded `export()` method dispatches on argument shape — there is no separate `exportCollection()`/`exportAllData()` method:

```ts
// ExportFlow (flows/export.flow.ts)
export(item: Collection, format: ExportFormat, path: string): Promise<void>
  // via the Collection's own sidebar/dashboard "Export" context-menu item (ContextMenuItem.Export)
  // -> "Export requests" (confirms request-selection, every request stays checked) -> "Select Export
  // Type" -> selects format -> "Done". This is the ONLY Collection export entry point covered —
  // Preferences -> Data's "Export the "<name>" Collection" button is a second real UI path to the
  // same dialogs but has no dedicated method/coverage here. That context menu now also has an
  // "Export OpenAPI Spec" entry alongside "Export" — clickContextMenu() matches by exact name so the
  // two don't collide, but a raw getByRole("menuitem", { name: "Export" }) without exact:true will
  // match both and throw a strict-mode violation.
export(item: Project, format: ExportFormat, path: string): Promise<void>
  // via Preferences -> Data -> "Export...<name>...Project" button -> selects format -> skips
  // request-selection (a Project export always includes every request) -> one file per workspace
  // written into `path` as a directory
export(directoryPath: string): Promise<void>
  // via Preferences -> Data -> "Export all data (N files)" -> always Insomnia v5, one file per
  // workspace -> no request-selection or format-selection step at all — dispatched by the single
  // string argument (`typeof itemOrDirectoryPath === "string"`), not a separate method
```

`ExportFormat` (`enums/export-format.ts`): `InsomniaV5 = "Insomnia v5" | Har = "HAR – HTTP Archive Format"`. The `Collection` overload writes a single file to `path`; the `Project` overload/the single-arg (`directoryPath`) overload write into a directory (one file per workspace) — `fs.mkdirSync(dir, { recursive: true })` it yourself before calling, same as any other Node fs usage in a spec.

All three overloads stub Electron's native dialogs first via `pageManager.exportPage` — `stubSaveFileLocation(filePath)` (wraps `BasePage.stubSaveDialog()`, for the single-file `Collection` overload) or `stubSaveDirectoryLocation(directoryPath)` (wraps `BasePage.stubFileChooser()`, for the multi-file ones) — call the matching stub _before_ triggering the export action, not after. The `Project` overload and the single-arg `directoryPath` overload also call `exportPage.dismissCompletionIfShown()` afterward (an "Export Complete" dialog that only sometimes appears for multi-file exports) and close Preferences only if `preferencesPage.isOpen()` (a multi-file export's completion can close the dialog as a side effect).

**An export writes its file asynchronously after the native dialog resolves** — reading the file the instant `exportFlow`'s call returns can catch it mid-write (truncated content). Use `misc/export-file.ts`'s `waitForExportedFile(filePath, timeout = 20000): Promise<string>` instead of `fs.readFileSync()` directly — it polls until the file exists and its size has stopped changing across several consecutive checks, then returns its content. The same file also exports `normalizeExportFixture(content: string): string`, which replaces dynamic fields (`id`/`created`/`modified`/`sortKey`/`startedDateTime`) with fixed placeholders — apply it to both sides before diffing a fresh export against a checked-in fixture.

Real example: `tests/data/export/happy-path.spec.ts` — exports a Collection via its context menu twice (HAR + Insomnia v5, `export(collection, ...)`) and a Project via Preferences -> Data to a directory (Insomnia v5, `export(project, ...)`), asserting each written file's content via `waitForExportedFile()`.

## Collection spec / lint / legacy unit tests (`workspaceFlow` / `pageManager.workspacePage`)

**INS-3528 unified the former standalone "Document" workspace into the Collection workspace** — there is no `Document` model, `DocumentFlow`, or `DocumentPage` anymore; any Collection can optionally carry an OpenAPI/Swagger spec (and, with a setting on, legacy unit test suites), and everything below lives directly on `workspaceFlow`/`workspacePage`. A spec-carrying Collection's requests live in the exact same standalone project tree a plain Collection's do — there is no separate embedded request tree/tab to special-case; use the regular `<x>RequestFlow.create(collection, ...)` pattern documented elsewhere in this file for those.

```ts
// workspaceFlow
create(parent: Project, item: Collection | McpClient | Environment): Promise<Collection | McpClient | Environment>
  // Collection = { name, spec?: Specification | string, id? } — spec, if given, is serialized to OpenAPI JSON
  // (or written verbatim if already a string) and typed into the spec editor right after creation. When
  // `spec` is set, the richer getCollectionSpec() read is returned instead of the plain getCollection() one.
createInEmptyState(parent: Project, collection: Collection): Promise<Collection>
  // creates via the project dashboard's empty-state "Enter API Spec" button instead of the project-tree
  // "API Collection" context-menu item — only rendered while `parent` has zero workspaces yet. Authors
  // `collection.spec` afterward the same way `create()` does. Real example: `tests/document/spectral-lint-errors.spec.ts`.
getCollection(item: string | { name: string; id?: string }): Promise<Collection | undefined>
  // lightweight — just id/name. Use this for a collection that doesn't carry a spec.
getCollectionSpec(item: string | { name: string; id?: string }): Promise<Collection | undefined>
  // the richer read: also populates `specification`/`rulesetType`/`version`. Use this after create()/for any
  // collection that does (or might) carry a spec. Real examples: `tests/document/happy-path.spec.ts`, `tests/data/import/url/import-swagger-api.spec.ts`.
```

`workspacePage.getFormat()` / `.selectFormat(format: SpecFormat)` — `SpecFormat.JSON | SpecFormat.YAML`. The structured `getSpecification()` below is the only way to read a spec's content back — `selectFormat()` has no committed spec exercising it yet; re-probe (§5) before relying on its exact selectors if you write one.

### Spec toolbar — Generate menu / format switch / docs preview

```ts
// pageManager.workspacePage
getOpenApiVersion(): Promise<string>   // reads the "OpenAPI x.y.z" toolbar label — "" for a Swagger 2.0 spec (no `openapi` field) or no spec content yet
isPreviewOpen(): Promise<boolean>      // whether the docs-preview pane (.pane-two) is currently visible
togglePreview(): Promise<boolean>      // clicks the preview toggle, returns the new isPreviewOpen() state
```

Real example: `tests/document/spec-editor-toolbar.spec.ts` (`getFormat`/`selectFormat`, `isPreviewOpen`/`togglePreview`, and `collection.version` from `create()`). Its title also mentions the "Generate" dropdown menu, but no committed spec actually exercises it yet — re-probe (§5) before adding assertions there.

### Tests tab (legacy unit test suites)

Since INS-3528, this tab only renders at all while Preferences -> General's "Show legacy unit tests" setting is on (`PreferencesPage.setShowLegacyUnitTests()`/`isShowLegacyUnitTestsEnabled()`, and `Settings.showLegacyUnitTests` on the model passed to `preferencesFlow.set()` — all renamed from their `...enableLegacyUnitTests` forms to match a later app rename of the checkbox's label from "Enable legacy unit tests". The real app's own `AppSettings.enableLegacyUnitTests` field key is unchanged — only this framework's names moved to track the UI label) — every method below turns that setting on first (`workspaceFlow`'s private `ensureLegacyUnitTestsEnabled()`/`openTests()`), so no separate setup call is needed. The tab itself is now located by `getByRole("tab", { name: "Tests" })`, not a `data-testid` — the app dropped `data-testid="workspace-test"` at the same time.

```ts
createTestSuite(item: string | { name: string; id?: string }, name: string): Promise<void>
  // opens item's Tests tab, clicks "New test suite" (always named "New Suite"), renames it to `name`
createUnitTest(testSuite: TestSuite, testName: string): Promise<void>
  // opens testSuite.collection's Tests tab, selects testSuite, clicks "New test" (always named "Returns 200"), renames it to `testName`
deleteTestSuite(item: string | { name: string; id?: string }, suiteName: string): Promise<void>
getTestSuiteNames(item: string | { name: string; id?: string }): Promise<string[]>
getTestSuite(item: string | { name: string; id?: string } | Collection, testSuiteName: string): Promise<TestSuite>
  // selects testSuiteName and reads back its name + unit tests (as UnitTest[]) + a `collection` reference.
  // Passing an already-resolved Collection (vs. a bare name/id) reuses it as-is, so any `specification`/`spec`/`lint` it already carries stays attached.
runAllTests(testSuite: TestSuite): Promise<{ summary: string; rows: UnitTestResultRow[] }>
  // selects testSuite, clicks "Run all tests", reads back the "Tests passed/failed N/M" heading (`summary`)
  // and each test's { title: string; passed: boolean } (`rows`)
```

`TestSuite = { name, tests: UnitTest[], collection: Collection }`, `UnitTest = { name }` — both in `models/collection.ts`. Real examples: `tests/document/unit-test-suite/unit-test-suite.spec.ts` (`createUnitTest`/`getTestSuite`/`runAllTests`), `tests/document/delete-test-suite.spec.ts` (`createTestSuite`/`getTestSuiteNames`/`deleteTestSuite`).

### Spectral linting & custom rulesets

```ts
getLintState(minLintErrors = 0): Promise<{ errors: number; warnings: number; entries: LintEntry[] }>
  // expands the lint panel and polls until the error count reaches `minLintErrors` — the lint pass reruns
  // asynchronously after setSpecification()/a ruleset change, so a bare read right after can catch a stale
  // count. Leave minLintErrors at 0 when no errors are expected. LintEntry = { code, description, severity: LintSeverity, lineRefs: string[] }.
removeRuleset(item: string | { name: string; id?: string }): Promise<void>
  // navigates to `item`'s page, then removes the active custom ruleset via its confirm modal, reverting to the default OAS ruleset
uploadRuleset(filePath: string, expectCode?: string): Promise<string[] | "invalid">
  // stubs the native file-open dialog with `filePath`, clicks "Upload custom ruleset". If accepted and
  // `expectCode` is given (e.g. "require-x-test-marker"), polls the lint panel until that rule id fires
  // (bundling/re-linting happens asynchronously) before returning the settled fired-rule-id list. If the
  // ruleset is rejected, dismisses the "Invalid Spectral Ruleset" dialog and returns "invalid" instead.
```

```ts
// pageManager.workspacePage — lower-level lint/ruleset reads
getLintSummary(): Promise<{ errors: number; warnings: number } | "none">  // "none" if no spec content yet or the editor reports no lint problems
getLintEntries(): Promise<LintEntry[]>       // expands every lint entry to also collect lineRefs — costs one click per entry
getLintEntryCodes(): Promise<string[]>       // rule ids only, without expanding any entry — cheaper inside a poll
getRulesetType(): Promise<RulesetType>       // Default | Custom, based on whether "View selected ruleset content" is showing
getSpecification(): Promise<Specification | undefined>
```

`collection.rulesetType`/`.version` are populated by `getCollectionSpec()`/`create()`; `collection.lint` is populated only by `getLintState()` (not by `getCollectionSpec()`/`create()` themselves — reading the lint summary means waiting for it to settle, which not every caller wants). **Real app bug found and documented via `test.fail()` per §9a: removing a custom Spectral ruleset (INS-3469)** relabels the toolbar back to "Default OAS Ruleset" but doesn't actually recompute lint — advisory warnings the custom ruleset's `extends: [spectral:oas]` pulled in persist even after removal and a full page reload. Real examples: `tests/document/custom-lint-ruleset/custom-lint-ruleset.spec.ts` (upload/remove/invalid-upload, `test.fail()` for INS-3469), `tests/document/spectral-lint-errors.spec.ts` (a corrupted spec surfacing a lint error with a real "Ln N" line reference via `getLintState()`).

`collection.spec?: Specification | string` and `collection.specification?: Specification` are the same type but different sources: `spec` is what you _author_ (pass to `new Collection(name, spec)` when constructing one — can carry full operation detail), `specification` is what `getCollectionSpec()`/`create()` read back from the spec's own collapsible "Info"/"Paths" outline panel next to the editor via `workspacePage.getSpecification()` (lossy — see below). `create()`/`createInEmptyState()` wrap `collection.spec.info`/`.paths` with boilerplate (`swagger: "2.0"`, `host: "localhost"`, `schemes: ["http"]`) before `JSON.stringify`-ing it into the editor when `spec` is a `Specification`; those boilerplate fields aren't part of the `Specification` model itself. `Specification`, `Info`, `License`, and `PathItem` all live in `models/collection.ts` alongside `Collection` (not a separate file) — generic names scoped to this one file, not exported project-wide concepts: `Specification = { info: Info; paths: Record<string, PathItem> }` — `paths` is keyed by path, then by lowercase HTTP method (the same nesting real OpenAPI/Swagger JSON uses, e.g. `paths["/pet/{petId}"].get`), NOT a flat array. `Info = { title, version, description?, license?: License }`, `License = { name, url? }`. `PathItem = Partial<Record<Lowercase<HttpMethod>, { operationId?, description?, tags?, parameters?, responses? }>>` — when authoring, fill in as much of an operation as you want (a `responses` entry, e.g. `{ "200": { description: "OK" } }`, is required for a clean lint pass, and any `{id}` path segment needs a matching `parameters` entry `{ name: "id", in: "path", required: true, type: "string" }` or the linter hard-errors). `info` and `license` on a read-back `specification` are real class instances (`instanceof Info`/`License`); each path's operations on a read-back `specification` are just empty objects (`{}`) keyed by lowercase method — the outline only exposes path+method-badge text, not full operation detail. **Two real limitations of reading the outline instead of the raw spec**, confirmed live: no "Servers" section renders for a Swagger 2.0 spec, so `host`/`schemes` aren't recoverable at all on a read-back `specification` (there's no `Specification.host` field); and the license row only renders `"License: <name>"` as text with no href/title attribute, so `License.url` is always `undefined` on a read-back `specification`. Real examples: `tests/document/happy-path.spec.ts`, `tests/data/import/url/import-swagger-api.spec.ts`.

## `templateTagFlow` / `pageManager.templateTagPage` (Insert/Edit Tag modal)

Covers Insomnia's built-in template tags (`{% uuid %}`, `{% base64 %}`, `{% hash %}`, `{% now %}`, `{% os %}`, `{% jsonpath %}`, `{% cookie %}`, `{% file %}`, `{% request %}`, `{% response %}`, `{% prompt %}`, `{% vault %}`) via the same "Edit Tag" modal the real app uses, not a separate custom UI. There is no dedicated "insert tag" button in the app — a tag is inserted the same way any other field value is: pass the raw `{% ... %}` text as part of the request itself, e.g. `httpRequestFlow.create()`'s `url` (multiple tags can be concatenated into one `url` string — each still gets its own independently-clickable span). Insomnia's own live syntax highlighting turns matched text into a clickable `<span class="nunjucks-tag" data-template="...">` with zero extra setup. `templateTagFlow.get()` only _reads_ an already-inserted tag — it doesn't insert one itself.

```ts
// TemplateTagFlow
get(template: string): Promise<TemplateTag>
  // Finds the `.nunjucks-tag` already on the currently-open request's page whose data-template
  // matches `template` (or, if `template` is a larger string, the "{% ... %}" substring inside it —
  // e.g. "http://host/{% cookie ... %}" still matches that tag's own span), opens its editor, reads
  // its functionName and resolved Live Preview, clicks "Done", and returns them. For a `hash` tag
  // specifically, also reads algorithm/digestEncoding/input (the only tag with dedicated argument
  // getters) — those 3 fields are undefined for every other tag type. The tag itself must already be
  // inserted via the request's own fields at creation time (e.g. httpRequestFlow.create()'s
  // url/headers) — this method never types into any field itself.

edit(template: string, target: TemplateTag): Promise<TemplateTag>
  // `hash` and `vault` tags only (the only two with dedicated argument setters). Opens the tag
  // matching `template` (its current raw text), then branches on target.functionName:
  //   "hash"  -> applies target.algorithm/.digestEncoding/.input via setAlgorithm/setDigestEncoding/
  //              setInput, returns { functionName: "hash", algorithm, digestEncoding, input, preview }
  //   "vault" -> applies target.credentialName via selectVaultCredential() (see below), returns
  //              { functionName: "vault", credentialName, preview }
  // Either way, reads the resulting Live Preview and clicks "Done" before returning. target.preview
  // is ignored as input either way — it exists only so callers can pass back a TemplateTag they
  // already have (e.g. from get()) instead of building a one-off object.
```

```ts
// pageManager.templateTagPage — lower-level access for editing an ALREADY-INSERTED tag's arguments,
// or for tags on fields other than the URL bar (set the raw text via that field's own Page setter first,
// e.g. RequestPage's header/body setters, then call these — same pattern as get() internally)
openTagByTemplate(template: string): Promise<void> // clicks the `.nunjucks-tag` whose data-template matches `template` exactly
getFunctionName(): Promise<string>                 // reads "Function to Perform", e.g. "hash"
getAlgorithm() / setAlgorithm(algorithm: HashAlgorithm): Promise<...>   // `hash` tag's "Algorithm" argument (index 0)
getDigestEncoding() / setDigestEncoding(encoding: DigestEncoding): Promise<...>  // `hash` tag's "Digest Encoding" (index 1)
getInput() / setInput(value: string): Promise<...>      // `hash` tag's "Input" argument (index 2) — the value to hash
  // All three setters wait for the Live Preview to settle (see gotcha below) before returning, not
  // just their own <select>/<input>'s DOM value — callers never need their own settle-wait between
  // setting one hash argument and the next.
selectVaultCredential(name: string): Promise<void>
  // `vault` tag's "Credential For Vault Service Provider" select — switches it to a cloud credential
  // already created via preferencesFlow.set({ cloudCredentials }) (see the Cloud (Vault) Credentials
  // section above). Only credentials matching this tag's own provider argument (e.g. a
  // {% vault 'aws' %} tag only lists AWS credentials) appear as options. Shares the same private
  // settle-poll the hash setters use (see gotcha below), plus its own extra non-empty check —
  // confirmed live the re-fetch off a new selection can pass through more than one transient shape
  // (an empty value, or a fixed "Credential ID or Credential Key is required" error) before settling.
getPreview(): Promise<string>                  // waits for the Live Preview to settle (see gotcha below), then reads it
done(): Promise<void>                               // commits the tag back into the field it was opened from
```

`setFunctionName()`/`getArgumentInputType()`/`setArgumentInputType()`/`refreshPreview()`/`cancel()` (and the locator helpers only they used, `getArgumentInputTypeButton()`/`getArgumentRow()`) were removed as dead code — no test switches a tag's function type, toggles an argument's Static-Value/Environment-Variable input mode, force-refreshes the Live Preview, or discards an unconfirmed edit today. Re-add whichever of these a future test needs.

`TemplateTagName` (`models/template-tag.ts`) is the union of the "Function to Perform" select's option values: `"faker" | "base64" | "now" | "uuid" | "os" | "hash" | "file" | "jsonpath" | "cookie" | "prompt" | "response" | "request" | "vault" | "custom"`. `TemplateTagArgumentInputType` is `"Static Value" | "Environment Variable"`. `HashAlgorithm` is `"md5" | "sha1" | "sha256" | "sha512"`, `DigestEncoding` is `"hex" | "base64"`. `TemplateTag` is `{ functionName: TemplateTagName; algorithm?: HashAlgorithm; digestEncoding?: DigestEncoding; input?: string; credentialName?: string; preview: string }` — `algorithm`/`digestEncoding`/`input` are only ever populated for a `hash` tag, `credentialName` only for a `vault` tag. A `vault` tag's raw `{% ... %}` text needs 3 positional args even when only the provider matters — e.g. `{% vault 'aws', '', '{}' %}` (provider, empty credential id/key, empty JSON metadata) — the second/third args are what `selectVaultCredential()`'s modal interaction fills in for real afterward.

**Confirmed live, non-obvious behavior:**

- There is no generic index-based argument accessor — each argument gets its own dedicated, named method instead (`getAlgorithm`/`setAlgorithm`, etc.), scoped to the tag type whose arguments they read/write (currently only `hash`'s 3 arguments are covered, since that's the only tag whose arguments a test currently drives directly). Adding coverage for another tag's arguments means adding that tag's own dedicated methods the same way, not a generic `getArgument(index)`.
- Each argument row also has its own gear-icon dropdown (`[data-testid="DropdownButton"]`, a sibling of the `label[data-arg-index]`, not a descendant, still index-based since it's positional across every tag type) that toggles the argument between a literal "Static Value" (the default) and "Environment Variable" (replaces the field with a `<select>` of the environment's variable names) — no current method drives it (removed as dead code, see above); re-add a page method to locate it via the shared `.form-row` ancestor if a future test needs to read/switch it.
- **Real timing race, worked around inside `setAlgorithm()`/`setDigestEncoding()`**: reading a `<select>`'s value via Playwright's `.inputValue()` _immediately_ after `.selectOption()` can momentarily still report the _old_ value in this Electron app, even though the underlying app state (and the Live Preview) has already updated. Both poll via `expect(select).toHaveValue(...)` before returning so callers never observe this race — don't read a `<select>`-backed argument back with a raw `.inputValue()` call chained directly after a raw `.selectOption()`.
- **Second, separate real timing race found via a 10-way-parallel stress rerun (2026-09-01), now fixed**: the app's own preview recompute (kicked off by any argument change) can itself lag behind the change by tens of ms — a single non-`"rendering..."` read (what `getPreview()` used to do alone) can observe the *previous* render's now-stale value if it's read before the new recompute has even started. Worse, `hash`'s three setters each fire their own independent, unguarded recompute, so calling one setter before the previous one's recompute finished let the two race — whichever resolved last (not necessarily the most recent one) won, silently reverting the preview to a stale value. This reproduced live as `edit-existing-tag-argument.spec.ts` reading back the *old* `md5` hash right after switching to `sha256`. Fixed with a shared private `waitForPreviewSettled()` (polls for the same non-`"rendering..."` value across two consecutive reads, the same shape `selectVaultCredential()` already used) called from the end of `setAlgorithm()`/`setDigestEncoding()`/`setInput()`/`getPreview()` — forcing each setter's recompute to finish before the next argument change fires means they can no longer overlap. Don't call any of these setters, then immediately read the preview (or fire another setter) without going through this shared wait — it's already built into each method, so a caller doesn't need its own extra wait.
- The tag span's own `title` attribute already holds a live-resolved preview value at all times (even before opening the modal) — not currently exposed through a Page method, since the modal's "Live Preview" is the documented, uniform way to read it for every tag type.
- `templateTagFlow.get()` never inserts a tag itself — insert it via the request's own fields at creation time (`httpRequestFlow.create()`'s `url`/`headers`/etc., same as any other field value), then call `get()` (or the lower-level `pageManager.templateTagPage` directly) to read/edit it. `RequestPage.setHeaders()`/`.setBody()` already write raw `{% ... %}` text correctly, same as `url`.
- The `file` tag's argument has no `<input type="file">` in the DOM at all — "Choose File" calls Electron's native open-file dialog directly via IPC (confirmed live; `BasePage.stubFileChooser()` is the mechanism for stubbing it, same as other native-dialog flows, but no current method drives this button — the `file` tag's argument is set today purely via its raw `{% file '<path>' %}` text at request-creation time, never through the modal UI). The file must also live under an allowlisted folder — see `Settings.dataFolders` below — or the tag resolves to an "Insomnia cannot access the file..." error instead of the file's contents.
- `file`-tag tests need a data-folder allowlist entry: `Settings.dataFolders?: string[]` and `PreferencesFlow.set({ dataFolders: [...] })` (which loops `PreferencesPage.addDataFolder(path)` — fills `input[data-testid="dataFolders"]`, clicks `button[data-testid="dataFolders-btn"]`, waits for the path to appear as a listed option) were added specifically to support this; a real native folder picker was not needed, it's a plain text input + Add button.

Real example: `tests/template-tag/happy-path.spec.ts` (`get()` for `uuid`/`base64`/`now`/`faker`/`jsonpath`/`os`/`request`, including an exact-value assertion for `base64` and format assertions for the others), `tests/template-tag/edit-existing-tag-argument.spec.ts` (`edit()`, switching a `hash` tag's algorithm from `md5` to `sha256` mid-edit and asserting both `get()`'s before-preview and `edit()`'s after-preview), `tests/template-tag/cookie-tag-reads-linked-cookie.spec.ts` (`cookieFlow.link()` then re-navigating to the request via `httpRequestFlow.get()` before touching its URL again, since `link()` navigates away to the Collection's Cookie Jar), `tests/template-tag/file-tag-reads-allowed-file/` (`preferencesFlow.set({ dataFolders: [...] })` + a fixture file), `tests/template-tag/header-templates.spec.ts` / `header-name-template-tag-resolves.spec.ts` (templated header value vs. name), `tests/template-tag/external-vault-credentials.spec.ts` (`edit()`'s `vault` branch against all three AWS/GCP/HashiCorp credentials created via `preferencesFlow.set({ cloudCredentials })`, resending the request afterward to confirm the resolved secret is genuinely usable, not just previewable). The `response` field tag is already covered by `tests/http-request/chained-response-tag.spec.ts`, so no duplicate test was added for it here.

## `gitSyncFlow` (Git Sync)

Covers the smart-HTTP Git Sync feature (branch/commit/history/push/merge) against a real local git server (`misc/git-server.js`, no SSH/file:// — Basic auth only). Tests under `tests/git-sync/` are the only ones that import `test`/`expect`/`DEFAULT_TIMEOUT` from `../../misc/git-fixtures` instead of `../../misc/fixtures` — everything else about the framework (Flow/Page/Model layering, `user` fixture shape) is identical.

```ts
// GitSyncFlow (flows/git-sync.flow.ts)
switchBranch(branch: string): Promise<void>            // checks out `branch` directly from the sync dropdown's branch list
commit(message: string): Promise<Commit>                // stages all changes, commits (no push), reads the commit back from History
commitAndPush(message: string): Promise<Commit>          // stages all changes, commits + pushes, reads the commit back from History
discardAllChanges(): Promise<void>                       // discards every uncommitted local change
createBranch(branch: string): Promise<void>              // creates + checks out a new local branch
mergeBranch(branch: string): Promise<void>               // merges `branch` into whichever branch is currently checked out
deleteBranch(branch: string, switchToBranch = "master"): Promise<void>  // checks out switchToBranch first (can't delete the checked-out branch), then deletes `branch`
```

`Commit` (`models/commit.ts`): `{ message: string; id?: string }` — positional constructor (`new Commit(message)`), `id` populated after `commit()`/`commitAndPush()` read it back from the History modal's row `data-key` (the real git OID).

**Creating a Git Sync project and its collections** goes through `workspaceFlow.create()`'s dedicated overloads, not a separate flow:

```ts
// WorkspaceFlow.create() — Git-specific overloads
create(item: Project, credentialName: string, repo?: Partial<GitRepoConnection>): Promise<Project>
  // item.type must be ProjectType.Git; clones from repo.uri (defaults to the local mock server's
  // URL, injected by the `user` fixture in git-fixtures.ts) and repo.branch (defaults to "master")
create(parent: Project, item: Collection, fileName: string): Promise<Collection>
  // creates a Collection with an explicit on-disk file name, decoupled from its display name —
  // only meaningful for Git Sync projects, where each collection is backed by its own file
```

`GitRepoConnection` (`models/git-repo-connection.ts`): `{ uri: string; branch?: string; cloneParentDir?: string }` — pass as `Partial<GitRepoConnection>`; every field is optional since `uri`/`branch` default. Only set `cloneParentDir` when a test needs to assert on/reuse the on-disk clone path — otherwise omit `repo` entirely and let it default to the mock server.

**Adding a credential** goes through `preferencesFlow`, not `gitSyncFlow`:

```ts
// PreferencesFlow.addGitCredential (flows/preferences.flow.ts)
addGitCredential(credential: GitCredential): Promise<void>
  // opens Preferences -> Credentials tab -> "Create Git Credential" -> Access Token form -> Save -> closes
```

`GitCredential` (`models/git-credential.ts`): `{ name: string; authorEmail: string; authorName: string; username: string; password: string }` — `name` is the app's own hardcoded display name for a custom/PAT credential ("Custom Git Credential"), not something the create form collects, so it can't be faker-generated. `misc/git-fixtures.ts` exports a ready-made `GIT_CREDENTIAL` constant matching the mock server's Basic auth (`testuser`/`testpass`) — use it directly rather than building a `GitCredential` literal by hand:

```ts
import { GIT_CREDENTIAL } from "../../misc/git-fixtures";
await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
await workspaceFlow.create(
  new Project(faker.string.alphanumeric(10), ProjectType.Git),
  GIT_CREDENTIAL.name,
);
```

**`pageManager.projectSettingsPage` (`pages/project-settings.page.ts`)** owns everything that renders inside the "Create or update dialog" — the same dialog component used for both the create-project flow and an existing project's Settings, per the app's own `ProjectModal`. This is the split to remember: `gitSyncPage` is the already-connected project's toolbar/dropdown/Commit/Branches/History modals; `projectSettingsPage` is the "Clone from Remote" setup sub-form (whether reached while creating a project, or later via Settings) plus Settings-only actions like relocating the on-disk repo:

```ts
// ProjectSettingsPage (pages/project-settings.page.ts) — "Clone from Remote" sub-form
// `gitSetupForm`/`scanForFilesButton` are public readonly Locator fields — pass them
// straight into BasePage's isHidden()/isDisabled() (inherited, not redeclared here).
gitSetupForm: Locator
scanForFilesButton: Locator
selectCredential(name: string): Promise<void>            // "Authorized as" dropdown, by credential display name
setRepositoryUrl(url: string): Promise<void>
selectBranch(branch: string): Promise<void>
chooseCloneLocation(folderPath: string): Promise<void>    // stubs the native folder picker
submitScanForFiles(): Promise<void>
confirmClone(): Promise<void>                              // "Clone Project" / "Clone and Migrate" / "Create Blank Project" / "Create"

// ProjectSettingsPage — create-project dialog (org feature flag/storage-rule blocking)
projectTypeTile(type: ProjectType): Locator                 // the tile's Radio control — pass to BasePage's isDisabled()
getBannerText(label: string): Promise<string | undefined>   // reads a labeled banner, e.g. "Git Sync Feature Disabled Banner" / "Project Storage Restriction Banner"

// BasePage (pages/base.page.ts) — inherited by every Page class
isHidden(target: Locator): Promise<boolean>                 // e.g. isHidden(projectSettingsPage.gitSetupForm) — true once Git Sync is blocked (feature flag/storage rule), form never renders
isDisabled(target: Locator): Promise<boolean>                // e.g. isDisabled(projectSettingsPage.scanForFilesButton) or isDisabled(projectSettingsPage.projectTypeTile(ProjectType.Git))

// ProjectSettingsPage — Settings-only (existing project)
navigate(): Promise<void>                                   // waits for "Move repository to another folder"
getRepositoryPath(): Promise<string>                         // reads the "Path to local files" field
relocateRepository(destinationParentDir: string): Promise<void>
getRelocationError(): Promise<string | undefined>            // e.g. a destination-already-exists collision
// close() (closed the Settings dialog) was removed as dead code — no test called it; every test that opens
// Settings finishes the flow some other way (e.g. navigating elsewhere) instead of explicitly closing it
```

`WorkspaceFlow.create()`'s Git-clone overload (below) drives these directly — it's the one place a test doesn't call `projectSettingsPage` itself. To open Settings for an _existing_ project: `workspaceFlow.openSettings(project)` (right-clicks the project node → "Settings" → waits for `projectSettingsPage.navigate()`), then interact with `pageManager.projectSettingsPage` directly. Real examples: `tests/git-sync/relocate-repository.spec.ts`, `tests/git-sync/relocate-repository-collision.spec.ts`, `tests/git-sync/disabled-via-feature-flag.spec.ts` (also uses `workspacePage.clickProjectTypeTile()`/`projectSettingsPage.getBannerText()`), `tests/git-sync/disabled-via-storage-rule.spec.ts` (also uses `projectSettingsPage.isDisabled(projectSettingsPage.projectTypeTile())`).

**Server-side ground-truth verification** — read the real bare repo on `misc/git-server.js` directly, independent of anything the app's UI reports:

```ts
// misc/git-fixtures.ts
getServerBranches(gitRepo?: string): Promise<string[]>
getServerCommits(gitRepo?: string, branch = "master"): Promise<ServerCommit[]>
  // ServerCommit = { id: string; message: string; authorName: string; authorEmail: string }
```

Both default `gitRepo` to the repo most recently created by the `gitRepo` fixture (which the `user` fixture in this file depends on) — call them with **zero arguments** in a normal spec; only pass `gitRepo`/`branch` explicitly when a test juggles more than one repo or branch at once. `getServerCommits()` returns `[]` (not a throw) for a branch that hasn't been pushed yet — useful for asserting a local-only commit/branch hasn't reached the remote.

There is no separate mock-server row to remember beyond this — `git-server.js` is a real smart-HTTP git server (via the `git-http-backend` npm package wrapping the system `git` binary), not a canned-response stub, so its state is asserted by literally reading the bare repo with `git log`/`git branch`.

**Adopting an existing local folder as a Git project** ("Open local folder" mode of the same create-project dialog, as opposed to "Clone from Remote") — no credential/repo URL needed, since it runs `git init` in the chosen folder rather than cloning. Pass the folder as the `Project`'s third constructor arg and go through the normal `create()` overload — `create()` detects `folderPath` and routes to this mode instead of creating a fresh project:

```ts
// models/project.ts
new Project(name, ProjectType.Git, folderPath)
  // folderPath: absolute path of an existing local folder to adopt

// WorkspaceFlow
create(item: Project): Promise<Project>
  // item.folderPath set -> clicks the dialog's "Open local folder" toggle,
  // picks it via the stubbed native folder picker, clicks "Open", then confirms
  // the one-time "Do you trust this folder?" prompt

// ProjectSettingsPage — "Open local folder" sub-form (sibling of the "Clone from Remote" one above)
selectGitOpenMode(): Promise<void>                  // switches the dialog into "Open local folder" mode
chooseOpenFolderLocation(folderPath: string): Promise<void>  // stubs the native folder picker, clicks "Choose folder"
confirmOpenFolder(): Promise<void>                  // clicks "Open", then "Open folder" on the trust prompt
getOpenFolderCollisionError(): Promise<string | undefined>   // "already connected to this folder" warning, if a folder already adopted by another project was picked
// openFolderConfirmButton is now a private field (only confirmOpenFolder() clicks it internally) — no test currently
// needs to isDisabled()-check it directly; make it a public readonly Locator again if one does
```

Real examples: `tests/git-sync/open-local-folder.spec.ts` (adopt + assert `.git` exists on disk), `tests/git-sync/open-local-folder-collision.spec.ts` (picking an already-adopted folder from a fresh create-project flow shows the warning and disables "Open").

## `cloudSyncFlow` (Cloud Sync)

Covers Kong Cloud-backed workspace sync (branch/commit/history/push/pull/delete against a GraphQL VCS backend) — a categorically different subsystem from local Git Sync above, even though its sync dropdown trigger reuses the exact same `data-testid="git-dropdown"`/`aria-label="Git Sync"` (confirmed live: both `sync-dropdown.tsx` and `git-sync-dropdown.tsx` render it identically; whichever mounts depends on whether the active project is Cloud-synced or has a git repo attached). Tests live under `tests/cloud-sync/` and import from the ordinary `../../misc/fixtures` (no dedicated fixtures file — unlike Git Sync, nothing here needs a per-test repo).

Every workspace this domain touches is a **pre-seeded fixture** on `misc/mock-api.js`'s `/graphql` mock (ported from insomnia-smoke-test's own `server/cloud-sync-api.ts`) — there is no `create()` overload for `ProjectType.Cloud`; a test always starts from `cloudSyncFlow.fetch(name)` with one of the three seeded names: `"My Collection R1"` (a Collection with one request, "New Request", body `foo=bar`), `"My Environment"` (an Environment-type workspace, Base Environment starts empty), `"My MCP Client"` (an MCP Client with one request). All three sit under a single local Project the app auto-creates on first launch ("Personal Workspace") — nothing needs pre-seeding on the local side, only the mock server's REST (`team-projects`) + GraphQL (`projects`) responses. A 4th fixture, **`"Ghost Collection"`**, is never meant to be `fetch()`'d — its own `rootDocumentId` is seeded to permanently disagree with the `wrk_*` key inside its one snapshot's `state[]`, simulating INS-2026's cross-workspace commit misalignment bug's end state, purely for exercising the dashboard-delete path below against a pre-existing "ghost" entry without reproducing the underlying race.

### Project dashboard — unsynced-file delete (INS-2026 fix, PR #10477)

A project's dashboard (its file/collection grid, reached via `cloudSyncFlow.openProjectDashboard(project)`) renders every local file next to every **unsynced** remote one (never pulled, or a pre-existing mismatched "ghost" like `"Ghost Collection"` above) as `GridListItem` cards — react-aria, so each is addressed by role `"row"` with its file/collection name as accessible name, not a `data-testid` of its own; the grid itself does carry one (`data-testid="workspace-grid"`), and every row locator must be scoped inside it — confirmed live: an unfetched fixture's sidebar tree also renders an `unsynced-workspace-node-*` row with the exact same role and accessible name, so an unscoped `page.getByRole("row", { name })` hits a strict-mode "resolved to 2 elements" violation the moment that sidebar row is also showing. Only a card with `scope === 'unsynced' && remoteId` renders a delete ("trash") button at all — confirmed live via source read, not just CSS: a synced or local-only card has zero matching elements, not one hidden at `opacity: 0`. On an unsynced card, the button *does* always exist in the DOM but sits at `opacity: 0` until the card is hovered or keyboard-focused (Tailwind `group-hover`/`group-focus`), animated by a `transition-all` — reading `getComputedStyle` once right after hover/focus can catch it mid-transition (confirmed live, flaky ~50/50); poll via Playwright's `toHaveCSS` instead, which `isFileDeleteButtonRevealed()` already does internally.

```ts
// CloudSyncFlow (flows/cloud-sync.flow.ts)
openProjectDashboard(project: Project): Promise<void>      // navigates to project's own dashboard grid
deleteUnsyncedFile(name: string): Promise<void>             // opens name's "Delete file" dialog and confirms it

// pageManager.cloudSyncPage
hoverFile(name: string): Promise<void>
focusFile(name: string): Promise<void>                      // GridListItem uses roving tabindex — this lands DOM focus on the card itself, same as a real Tab/arrow-key traversal
hasFileDeleteButton(name: string): Promise<boolean>          // whether the button is rendered at all (scope==='unsynced'&&remoteId gate)
isFileDeleteButtonRevealed(name: string): Promise<boolean>   // opacity-polled — only meaningful when hasFileDeleteButton() is true
isFileCardVisible(name: string): Promise<boolean>
openFileDeleteDialog(name: string): Promise<void>            // hovers + clicks the trash button
getFileDeleteDialogText(): Promise<string>                   // heading + warning body of the open "Delete file" dialog
dismissFileDeleteDialog(method: DialogDismissMethod): Promise<void> // DialogDismissMethod.XButton/Escape/ClickOutside — overlay is isDismissable
confirmFileDelete(): Promise<void>                           // dialog closes optimistically — doesn't itself wait for the card to disappear or a failure toast
waitForFileDeleteFailureToast(name: string): Promise<void>
```

**`DialogDismissMethod` (`XButton`/`Escape`/`ClickOutside`) is exported from `pages/cloud-sync.page.ts` itself, not from `enums/`** — an intentional one-off exception to the usual "fixed values live in `enums/`" rule, since it's only ever consumed alongside a `cloudSyncPage` import: `import { DialogDismissMethod } from "../../pages/cloud-sync.page"`.

Confirming a delete calls `archiveBackendProject(backendProjectId)` (`insomnia-vcs`), which runs a `projectArchive` GraphQL mutation directly against the id — no local pull first, and no local `meta.json` to clean up for a never-pulled file. `misc/mock-api.js`'s handler for it accepts a test-only failure knob, wrapped by `misc/fixtures.ts`'s **`setCloudSyncArchiveFailure(enabled)`**: while `true`, the mutation returns a GraphQL error instead of succeeding, surfacing as the app's own real "Failed to delete remote file" toast (via `insomnia-vcs`'s `runGraphQL` throwing, caught by the delete route's `clientAction`) rather than a canned rejection. Not auto-cleared by `resetCloudSyncState()`'s full per-session reset in the middle of a test — call it with `false` again once the failure has been observed. **`getCloudSyncProjectInfo(name)`** (`misc/fixtures.ts`, backed by a new `GET /_admin/cloud-sync/project-info`) reads back one of the four fixture projects' own backend-project id, `rootDocumentId`, its latest snapshot's `wrk_*` key, and whether it's been archived this session — the only way to identify a **never-pulled** file's own backend project id for a main-process-log assertion (mirroring `delete-workspace-log-signature.spec.ts`'s pattern of reading local `meta.json`, which doesn't exist for a file that was never pulled).

**Gotcha — a new synchronous locator-getter method must be added to `misc/step-instrumentation.ts`'s `EXCLUDED_METHODS`.** `fileCard(name)` (the private row locator both Page methods above resolve through) returned a broken chain (`TypeError: ...getByLabel is not a function`) until added there — confirmed live: the auto-instrumentation wraps every prototype method into an async `test.step` regardless of whether the original was synchronous, so a synchronous helper that returns a `Locator` for further chaining (not a `Promise`) breaks the same way `rows`/`caCertificateRow`/`clientCertificateRow`/etc. already needed the same exclusion for.

```ts
// CloudSyncFlow (flows/cloud-sync.flow.ts)
fetch(name: string): Promise<void>                        // pulls the named backend workspace into the local sidebar and navigates into it; backs out of sidebar collection-focus mode first if needed
discardAllChanges(): Promise<void>                        // via the sync dropdown's "Discard all changes" — see gotcha below
commitAndPush(requestName: string, message: string): Promise<void> // stages requestName's own row, commits + pushes
restoreSnapshot(message: string): Promise<void>           // opens History, restores the snapshot whose row shows `message` — see gotcha below
createBranch(branch: string): Promise<void>                // opens Branches, creates + switches to it, closes Branches
mergeBranch(branch: string): Promise<void>                 // opens Branches, merges branch into the current one, closes Branches
delete(name: string, mode: DeleteMode): Promise<void>
  // DeleteMode.Local removes only the local copy; DeleteMode.Full deletes it everywhere
  // "local" = "Remove Local Copy" (stays fetchable as unsynced afterward); "full" = "Delete Permanently" (gone everywhere)
```

**Coverage gap, flagged (not just a doc fix):** a commit-without-push (`commit(requestName, message)`, Flow + underlying `cloudSyncPage.commit()`) and a standalone, non-modal push (`cloudSyncPage.push()`/`waitForPushSettled()`) were both added then removed again as dead code during an exploration that ended up not needing them (see the race-condition section below) — no test currently calls either. If a future test needs commit-without-push or a standalone push, that Page/Flow method needs to be written back in — it does not currently exist anywhere in this codebase. An **actual pull**, unlike those two, is now exercised: `cloudSyncPage.clickPull()` (companion to the pre-existing `waitForPullAvailable()`) clicks the sync dropdown's "Pull" action and lets a real pull run to completion — see `tests/cloud-sync/concurrent-workspace-creation-race.spec.ts` below. `tests/cloud-sync/pull-remote-changes.spec.ts` still only asserts the "Pull" action becomes **enabled**; it doesn't click it.

A handful of `pageManager.cloudSyncPage` methods have no Flow wrapper at all and get called directly even outside the Branches modal, because a test needs to read a live value back rather than just fire an action: `reselect(name)` (re-clicks a workspace's sidebar row without going through the "unsynced" fetch path — see the pull gotcha below), `backToAllProjects()` (exits sidebar collection-focus mode so another project's "unsynced" row becomes visible again — needed between `fetch()` calls in the same test), `isCommitDisabled()` (opens the sync menu, reads the "Commit" action's `aria-disabled`, closes the menu again), `waitForPullAvailable()` and `closeSyncMenu()` (see the pull gotcha below).

**Confirmed live gotcha — stale editor/table pane after an external mutation.** An already-open request editor (or environment KV table) does NOT refresh its own content after `discardAllChanges()`/`restoreSnapshot()` reverts or replaces the underlying document server-side (presumably also true of a real pull, now that `clickPull()` makes one exercisable — see the coverage-gap note above — but not directly checked by the one test that pulls, which reads on-disk VCS state instead of the editor pane) — polling `httpRequestPage.getBody()` (or `environmentFlow.get()`) right after either of these resolves just keeps reading the pre-mutation value indefinitely, no matter how long you poll. Re-navigate to force a fresh read instead — e.g. call `httpRequestFlow.get(name, collection)` again before reading the body. Real example: `tests/cloud-sync/discard-commit-push-and-restore.spec.ts`.

**Branches modal** — has separate local/remote lists (unlike Git Sync's single list), so this framework calls `pageManager.cloudSyncPage` directly rather than through a Flow wrapper, keeping the whole modal open across several actions (a Flow-level open+act+close-per-call, mirroring `gitSyncFlow`'s branch methods, closes the modal between actions, which just adds churn here since nothing needs the modal shut in between):

```ts
// pageManager.cloudSyncPage
openBranchesDialog(): Promise<void>
fetchRemoteBranch(branch: string): Promise<void>         // pulls a remote-only branch into the local list
checkoutLocalBranch(branch: string): Promise<void>
deleteLocalBranch(branch: string): Promise<void>          // 2-click confirm; disabled while checked out
createBranch(branch: string): Promise<void>               // switches to it immediately
isLocalBranchListed(branch: string): Promise<boolean>
isLocalBranchDeleteDisabled(branch: string): Promise<boolean>
closeBranchesDialog(): Promise<void>
```

Real example: `tests/cloud-sync/branches.spec.ts`.

**Pulling a new remote commit** needs the app's background "check for remote changes" logic to actually run, which fires on a real OS focus change — simulated via `appFlow.simulateMainWindowFocusChange()` (sends the `mainWindowFocusChange` IPC event to every window), after re-selecting the workspace's own sidebar row (`cloudSyncPage.reselect(name)`) so the route has fresh loader data to act on. `${MOCK_API_SERVER}/_admin/cloud-sync/new-commit` (`PUT`, body `{ enabled: boolean, sessionId: SESSION_ID, projectId?: string }` — `SESSION_ID` also imported from `misc/fixtures.ts`, no dedicated toggle helper wraps this one) toggles the mock server into serving an alternate "there's a new remote commit" snapshot history. Two fixture workspaces have one of these alternate histories: `"My Environment"` (the default when `projectId` is omitted, for back-compat) and `"My Collection R1"` — pass the matching project id to target the latter (see `CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS` in `misc/mock-api.js`; `"My MCP Client"` still isn't covered). Always pair the `enabled: true` toggle with a matching `enabled: false` afterward. Real examples: `tests/cloud-sync/pull-remote-changes.spec.ts` (asserts the sync dropdown's "Pull" action becomes enabled with a "Pull 1 Commit" label — matches insomnia-smoke-test's own scope for this scenario, which likewise never asserts on post-pull content) and `tests/cloud-sync/concurrent-workspace-creation-race.spec.ts` (uses the `"My Collection R1"` variant since its race needs a regular collection, not an environment-scope workspace).

**Reproducing INS-2026's cross-workspace race** (`tests/cloud-sync/concurrent-workspace-creation-race.spec.ts`) — before app PR #10458 ("One VCS instance per workspace"), every Cloud Sync workspace shared one module-level VCS singleton, so a `sync.invoke` call for one workspace could stomp another concurrently in-flight one's mutable `_backendProject`. The stock race window is only tens of milliseconds, so widening it deterministically without touching app product code needs `setCloudSyncGraphQLDelay(ms, projectId?)` (`misc/fixtures.ts`) — a mock-server-side hold (test infrastructure, backed by `misc/mock-api.js`'s new `POST /_admin/cloud-sync/delay`) on Cloud Sync GraphQL responses, since the app's calls run in the Electron main process and so can't be intercepted client-side via Playwright's network routing, nor given a spec-controlled header the way the other mock servers' `x-reply-delay-ms` works.

Two things matter for picking **which** operation to stall:

- **Stall `push()`, and nothing corrupts.** It only ever reads local VCS state and writes remotely — the network call resuming after a delay never writes anything locally, so there's nothing left for a concurrent workspace to have clobbered by the time it returns. A first attempt at this spec tried exactly that and passed unconditionally, fix or no fix — a false-positive test.
- **Stall `pull()` instead.** Its first network call (`_getOrCreateRemoteBackendProject()`'s own `_queryProject()` — not, as it may look, `customFetch()`'s `_queryBranch` further down) is the one this delay actually stalls; once that resolves, `customFetch()` queries branches/snapshots/blobs over the network **then** writes them locally (`_storeBlobsBuffer`/`_storeSnapshots`/`_storeBranch`) afterward, keyed by whichever backend project the singleton's `_backendProject` happens to point at **at that moment** — the exact "network await, then local write" shape the original bug needs.

Always scope the delay to the stalled workspace's own backend project id (matched against `variables.id`/`.projectId`/`.teamProjectId`) — an unscoped delay also stalls a second, unrelated workspace's own automatic push (a brand-new collection under a remote project pushes itself immediately, on the same session), confirmed live to balloon an unrelated "New Collection" from ~200ms to ~48s. And don't rely on a toast/UI signal for "did the stalled operation finish" once you've also created something that navigates away from the stalled workspace's page (its component unmounts, so no toast ever renders even though the underlying operation keeps running in the main process) — poll on-disk VCS state directly instead (`<dataPath>/version-control/projects/<id>/blobs/**`, counting files).

**What actually goes wrong pre-fix is a redirected query returning empty, not a cross-key content swap.** Once the stalled workspace's `_backendProjectId()` gets repointed at the newly-created sibling mid-flight, its resumed `snapshots`/`blobs` queries carry the sibling's id — but the sibling is freshly-created and unregistered in the mock's seed data, so those queries just come back empty; `customFetch()` writes nothing, and the stalled workspace's blob count never increases. It's never actually observed as one workspace's snapshot `state[]` gaining the other's `key` entries (or vice versa) — a `key`-based cross-contamination assertion would still pass even under this exact corruption, so don't rely on one as the regression signal.

Two complementary assertions catch this correctly, and a spec doing this should carry both:
- `expect.poll(() => countBlobFiles(dir), {...}).toBeGreaterThan(before)` on the stalled workspace's own directory — the timeout itself *is* the regression signal pre-fix (confirmed live, see below), not just a slow-disk guard.
- A direct on-the-wire check via `getCloudSyncGraphQLRequestLog()` (`misc/fixtures.ts`, backed by `misc/mock-api.js`'s `GET /_admin/cloud-sync/request-log?sessionId=...` and its per-session `requestLog: []` — every GraphQL request this session makes, logged as `{ operationName, projectId, at }` at arrival time, before any delay is applied): snapshot the log's length right before triggering the stall, then afterward slice from that point and assert every `snapshots`/`blobs`-named entry still carries the stalled workspace's own project id. Filter to exactly `["snapshots", "blobs"]`, never also `"branch"` — creating the sibling triggers its own immediate `push()`, which legitimately issues its own `branch` query scoped to *its* id, and `pull()`'s `customFetch()` is the only caller of `snapshots`/`blobs` queries, so those two names are the unambiguous ones. This is what actually goes wrong on the wire, independent of whether it happens to also leave a visible trace on disk.

**Sanity-check a regression test like this by breaking the fix on purpose, not just by reading the diff — and by actually running it, not just reasoning about it.** Verified twice, on live runs: first by temporarily collapsing the app's `getVCSForWorkspace` (`packages/insomnia/src/main/cloud-sync/vcs.ts`) back to a shared singleton (keying every call to one constant instead of `workspaceId`, without touching any call site's signature); later by checking out the app repo's actual pre-fix commit (`3e97ba7bfe^`, one before "One VCS instance per workspace") and running the spec unmodified against it. Both times the spec failed — with the stalled workspace's pulled commit silently vanishing (its blob count never increased, exactly per the `expect.poll` timeout above) rather than landing anywhere, and the failure surfaces at the `expect.poll` line specifically, before the request-log assertion is even reached — then reverting and confirming it passes again on today's `develop`. A regression test that can't be made to fail this way is worthless regardless of how principled its design looks on paper.

**Deleting a workspace** — reached via the sidebar row's own "SideBar Workspace Actions" dropdown (a `menuitemradio`-based menu, not a plain button, despite looking like one), not the project dashboard's grid-card dropdown:

```ts
// pageManager.cloudSyncPage
openDeleteWorkspaceDialog(name: string): Promise<void>
deleteWorkspaceLocalOnly(): Promise<void>       // confirms with "Remove Local Copy" (the dialog's default radio)
deleteWorkspacePermanently(): Promise<void>     // selects "Delete Permanently" first, then confirms
isSynced(name: string): Promise<SyncStatus | undefined>
  // Synced = the REAL local workspace node is showing; Unsynced = the sidebar's "unsynced"
  // placeholder row is showing; undefined = neither (fully gone). Deliberately checks each
  // row's own testid rather than a plain by-name tree lookup (e.g. `workspaceFlow.getCollection()`),
  // since the placeholder renders with the same accessible name as the real node and a
  // name-only lookup can't tell them apart.
```

A `"local"` delete's workspace reliably reappears as an **unsynced dashboard card** in the project's grid view — but does NOT reliably reappear as an `unsynced-workspace-node-*` **sidebar row** while a different workspace is still the active/focused one (this needs more investigation; don't assert on the sidebar row reappearing without first confirming the dashboard view is what's on screen). Real example: `tests/cloud-sync/delete-workspace.spec.ts`, `test.afterAll(() => resetCloudSyncState())` (from `misc/fixtures.ts`) to undo the "full" delete's archive so later spec files still see the fixture workspace.

**A brand-new collection's own local commit sequence runs synchronously inside its creation, before the "New Collection" dialog closes** — confirmed live: `workspaceFlow.create()` doesn't return until `switchAndCreateBackendProjectIfNotExist`/`status`/`stage`/`takeSnapshot` finish, well under 1 second, all inside one blocking, focus-trapped modal that no other click or IPC event can interrupt while it's open. So an INS-2026-style "unrelated UI action interleaved with a fresh collection's own creation" can't be driven through the UI at all on a stock build — and there's no test-only way to widen that window without a hook in the app's own source, which is out of scope here (see `SKILL.md`'s Scope Constraint).

**`tests/cloud-sync/unrelated-action-during-collection-creation.spec.ts` covers the closest test-only-feasible variant instead**: it reuses `concurrent-workspace-creation-race.spec.ts`'s proven mechanism (stall `"My Environment"`'s `pull()` via `setCloudSyncGraphQLDelay(ms, projectId)` — stalling `push()` instead is already known to pass unconditionally, a false-positive) and layers a genuinely concurrent, unrelated mutation on top: while the pull is stalled, it renames that same workspace (`workspaceFlow.rename()`) **and** creates a brand-new sibling collection Y. Confirmed live: the rename survives intact, alongside the same invariants the race spec already checks (blob count grows once released, pull queries stay scoped to their own project id, neither snapshot gains the other's `key`).

## `appFlow` (main process / app lifecycle, not a UI domain)

Covers operations against the Electron main process itself rather than any DOM/UI surface — there is no Page for this domain, since none of it involves the renderer. `AppFlow` reaches the main process via `this.flowManager.electronApp!` (an `ElectronApplication`, threaded through `FlowManager`'s constructor by both `misc/fixtures.ts` and `misc/git-fixtures.ts` — not through `PageManager`, which only ever hands it to Pages for native-dialog stubbing).

```ts
// AppFlow (flows/app.flow.ts)
getStdoutListenerCount(event: string): Promise<number>   // process.stdout.listenerCount(event) in the main process — pass any Node event name, e.g. "error"/"close"/"drain"
emitStdoutEpipeError(): Promise<void>             // schedules an async EPIPE error on process.stdout (via process.nextTick, mirroring how the OS actually delivers it), then flushes the main-process event loop with setImmediate before returning
isAlive(): Promise<boolean>                       // round-trips a trivial evaluate() call; rejects with a "Target closed" error instead of returning if the main process crashed
getDataPath(): Promise<string>                    // app.getPath("userData") in the main process — the same path Insomnia backs up its NeDB .db files under (<dataPath>/backups/<version>/)
closeHiddenScriptWindow(): Promise<void>          // finds the hidden BrowserWindow (titled "Hidden Browser Window") Insomnia uses to execute pre-request/after-response scripts and closes it directly, simulating a crash mid-script; throws if no such window is currently open
restart(): Promise<Page>                          // closes the current Electron app and relaunches a fresh one against the SAME dataPath/env, rewiring pageManager/flowManager onto it in place — see below
```

**`restart()`** closes `flowManager.electronApp` and relaunches a fresh `ElectronApplication` against the same `dataPath`/env (`FlowManager.launchConfig`, a `{ dataPath, skipOnboarding, vaultKey, vaultSalt }` snapshot from the `user` fixture), then rewires `flowManager.electronApp` (`setElectronApp()`) and every cached Page in `pageManager` (`setWindow()` → each Page's own `setContext()`) onto the new window — so `user.pageManager`/`user.flowManager` keep working unchanged. Navigates back to the workspace itself before returning. Since `dataPath` is unchanged, on-disk state (NeDB docs, `version-control/projects/`) survives the restart like a real quit/reopen; only in-memory state resets. Real example: `tests/cloud-sync/new-collection-survives-restart.spec.ts`.

**Plumbing this required**: `misc/fixtures.ts` exports `launchInsomniaElectron(options)` (factored out of the `insomnia` fixture, skipping `resetCloudSyncState()`/`resetVaultState()` since a restart must preserve existing state); `FlowManager` gained an optional `AppLaunchConfig` constructor param (`launchConfig` getter) and `setElectronApp()`; `PageManager`/`BasePage`'s `page`/`insomnia` fields are no longer `readonly` and gained `setWindow()`/`setContext()` (the latter excluded from `step-instrumentation.ts`'s auto-wrapping — it must stay synchronous); the `window` fixture's teardown tolerates `win` already being closed by a `restart()`.

Real example: `tests/app/stdout-epipe.spec.ts` — regression test for a main-process crash on an async EPIPE write error (asserts a startup error listener is registered, then that the app survives a simulated EPIPE). `tests/app/database-backup-on-launch.spec.ts` — asserts a backup happens on _every_ launch (not just a real version bump): this framework's mocked update-check endpoint always returns 200, and the app's own trigger treats any successful response as "found a newer version" regardless of status/body, so no UI action is needed to make one happen.

### Pre-seeding a data directory before launch (`tests/migration/`)

`misc/fixtures.ts` exposes `dataPath` (the temp directory passed as `INSOMNIA_DATA_PATH`) and `skipOnboarding` (defaults `true`) as their own overridable fixtures, not just inline values inside the `insomnia` fixture — a spec that needs the app to launch against a pre-populated data directory, or against a fresh v13 onboarding/login screen instead of the usual skip-straight-to-workspace state, does `test.extend({ dataPath: async ({ dataPath }, use) => { ...write files into it...; await use(dataPath); }, skipOnboarding: async ({}, use) => { await use(false); } })` in the spec file itself (mirrors insomnia-smoke-test's own `playwright/test.ts` fixture shape). `skipOnboarding: false` becomes `INSOMNIA_SKIP_ONBOARDING: ""` (empty string), not `"false"` — `entry.client.tsx`'s `if (skipOnboarding)` guard treats any non-empty string, including the literal text `"false"`, as truthy.

A spec built this way can't use the `user` fixture **only when the seeded state actually reroutes the app somewhere other than the normal workspace** (its `workspacePage.navigate()` call hangs forever waiting for a screen that never loads) — inject `window` directly instead and drive raw Playwright locators against it, same as insomnia-smoke-test's own migration specs which have no page-object layer either. When the seeded state doesn't reroute anything (a same-workspace on-launch data upgrade, not a screen swap), the plain `user` fixture works fine and the rest of the framework's Flow/Page layer stays usable — see the v7→v8 NeDB example below.

Real example: `tests/migration/git-repo-onboarding.spec.ts` — writes `insomnia.Project.db`/`insomnia.GitRepository.db` (raw NeDB line-delimited JSON, no checked-in fixture directory needed) directly into `dataPath` before launch, giving the app a `GitRepository` doc with no `repoMigrationVersion` stamp. `getInitialEntry()` (`packages/insomnia/src/ui/utils/router.ts`) checks for a pending git migration before it ever looks at onboarding state, so this routes straight to `/git-migration` first; the spec then drives Continue → Update Now → Open Insomnia and confirms the v13 onboarding heading only appears at the very end, never before the migration screen.

`tests/migration/legacy-db-migration/legacy-db-migration.spec.ts` — a different `dataPath`-seeding shape: instead of writing NeDB line-delimited JSON inline, its `test.extend({ dataPath: ... })` `fs.promises.copyFile`s every file out of a checked-in fixture directory (`tests/migration/legacy-db-migration/insomnia-legacy-db/`, one `insomnia.<Model>.db` per collection, captured from a real legacy v7 install) into `dataPath` before launch — reach for a copied fixture directory like this instead of hand-writing NeDB JSON when the seed data needs to already exercise realistic cross-collection relationships (a Project → Collection → Request → Design Document chain here) rather than one isolated doc. This migration doesn't reroute anywhere — Insomnia just upgrades the on-disk schema in place and lands in the normal workspace — so the spec uses the plain `user` fixture and reads the migrated data back through the regular Flow layer (`workspaceFlow.getProject()`/`.getCollection()`/`.getCollectionSpec()`, `httpRequestFlow.get()`) instead of raw `window` locators.

### Hidden script-execution window recovery (`tests/app/cancel-pre-request-script.spec.ts`, `hidden-window-closed-recovers.spec.ts`, `hidden-window-hangs-recovers.spec.ts`)

Three distinct recovery paths, each needing a request whose `preRequestScript`/`afterResponseScript` is a plain string of real JS (both `HttpRequest` fields already exist — no Model change needed):

- **Cancel while sending**: give the request a `preRequestScript` that `await`s a multi-second `setTimeout`-based delay, call `pageManager.httpRequestPage.send()` directly (not `httpRequestFlow.send()`, which blocks until the response fully arrives) after navigating to the request with `httpRequestFlow.get(name)`, poll `responsePage.getSendButtonState()` (`enums/send-button-state.ts`) until `"sending"`, then `responsePage.cancelRequest()`. The response pane's error text is `"Execute pre-request script failed: Request was cancelled"` — check for it with `responsePage.hasMessage("Request was cancelled")` (substring match, not exact — `getByText()` without `{ exact: true }`).
- **Hidden window closed mid-script**: lower `Settings.timeout` (via `preferencesFlow.set({ timeout: 1000 })`) below an `afterResponseScript`'s delay so the script itself times out (`responsePage.hasMessage("Executing script timeout")`), then call `appFlow.closeHiddenScriptWindow()`, restore a longer timeout, and send a _different_ request to confirm recovery.
- **Hidden window hangs**: same shape, but the request's `preRequestScript` is a genuine `"while (true) {}"` infinite loop — the app is expected to detect the hang once `Settings.timeout` elapses and restart the window on its own, no `appFlow` call needed.

**Confirmed live gotcha — don't resend the exact same request you just cancelled/timed-out to prove recovery.** `httpRequestFlow.send()`'s wait condition (`responsePage.navigate()`) only checks that the response pane's "timeline" tab element exists, which is already true from the _previous_ (cancelled/errored) response — so a second `send()` on the same still-open request can read a stale/mid-flight snapshot instead of the new response, intermittently returning `statusCode: undefined` even though the UI shows `200 OK` moments later. All three specs above create a second, plain request up front and send _that_ one to prove the app recovered, sidestepping the race entirely (mirrors how the real smoke-test's own cancel scenario moves on to different requests rather than resending the same one).

## Enums (`enums/`)

```ts
AuthType: None |
  Inherit |
  ApiKey |
  Basic |
  Digest |
  Ntlm |
  OAuth1 |
  OAuth2 |
  AwsIam |
  Bearer |
  Hawk |
  Asap |
  Netrc |
  Token; // enums/auth-type.ts — AuthTabPage's Auth-tab type dropdown (shared by RequestPage and FolderPage); OAuth1 and OAuth2 have Page setters/getters today, every other option doesn't yet
HttpMethod: Get | Post | Put | Patch | Delete | Head | Options | Query;
ContentType: Multipart |
  Form |
  GraphQL |
  JSON |
  XML |
  YAML |
  EDN |
  Plain |
  File |
  NoBody;
ContextMenuItem: Collection |
  HttpRequest |
  Folder | // "New Folder" — the visible label; creates a Folder under the right-clicked Collection/Folder
  EventStreamRequest |
  GraphQLRequest |
  WebSocketRequest |
  GrpcRequest |
  SocketIORequest |
  Document |
  McpClient |
  MockServer |
  Environment |
  Import |
  Settings |
  Sort |
  RunCollection |
  Delete |
  Rename |
  Duplicate |
  Pin |
  OpenInNewTab | // "Open in New Tab" — for a Folder, opens its own Auth/Headers/Scripts/Environment/Docs tab (not the same as "Settings", which only opens a rename/move dialog)
  Export |
  GenerateCode;
CollaboratorRole: Owner | Admin | Member; // enums/collaborator-role.ts — InvitePage's per-row role-menu selector, OrganizationFlow.invite()'s Collaborator.role field
ImportSource: File | Url | Curl | Clipboard | Mcp;
LintSeverity: Error | Warning; // enums/lint-severity.ts — WorkspacePage.getLintEntries()/.getLintRowSummary()
ProjectType: Local | Cloud | Git;
RulesetType: Default | Custom; // enums/ruleset-type.ts — Collection.rulesetType, WorkspacePage.getRulesetType()
ScriptSandboxRuleGroup: GlobalAndNodeJsInternals |
  AsyncScheduling |
  RuntimeAPIs |
  PrototypeMutation |
  StackInspection |
  AccessorHelpers |
  GlobalObjectAliases |
  NodeJsInternals |
  Scopes;
// enums/script-sandbox-rule-group.ts — Preferences → Scripting tab's per-rule-group switches
ScriptTab: PreRequest | AfterResponse; // enums/script-tab.ts — RequestPage's typeScripts()/undoScript()/switchScriptTab() sub-tab selector
SendButtonState: Idle | Sending;
SpecFormat: JSON | YAML;
TreeNodeType: Project | Workspace | Request | Folder | Empty | Unknown;
```

## App launch — dev-mode source checkout is now the default (2026-09-07)

`misc/fixtures.ts`'s `insomnia` fixture no longer launches `/Applications/Insomnia.app` by default. It now launches straight out of a sibling `../insomnia` source checkout instead — the local `electron` binary loading `packages/insomnia`'s main/preload bundles (one-shot-built via `esbuild.entrypoints.ts`, cached at module scope since `playwright.config.ts` pins `workers: 1`) with its renderer served by a Vite dev server (`npm run start:dev-server` on port 3334, started as an extra `webServer` entry in `playwright.config.ts`). This means the app under test always reflects whatever's currently checked out in `../insomnia`, not whichever build happened to get installed/cached last — so a stale-binary caveat like "re-run against a binary built after `<date>`" no longer applies the way it used to; the fix just needs to be present in the sibling checkout.

Opt-out paths, both read once at module scope (not per-test):

- Setting `INSOMNIA_BINARY` (CI always does — see `.github/workflows/playwright.yml`) skips dev mode entirely and launches that binary directly, same as before.
- `INSOMNIA_DEV_MODE=false`/`0` (with `INSOMNIA_BINARY` unset) falls back to the packaged `/Applications/Insomnia.app` build locally without pointing at a specific binary.

No spec-facing API changed — this only affects local/CI environment setup, not anything a test calls.

## Mock servers (already running via `playwright.config.ts`'s `webServer`)

**Every server below except `mock-api.js` accepts an optional `x-reply-delay-ms` header** (a gRPC metadata entry, for `grpc-server.js`) to delay its reply by that many milliseconds — set it via a request's `headers` field to widen the window for reliably cancelling/disconnecting a call that's still in flight. Default is no delay (0ms) everywhere except `grpc-server.js`'s `LotsOfReplies`, which already throttles 50ms between replies for its own reasons and treats the header as a per-reply override rather than a one-time delay. **After editing any `misc/*.js` mock server, kill its already-running `node` process before re-testing** — `playwright.config.ts`'s `reuseExistingServer` setting means a stale process silently keeps serving the old code otherwise (see the `project-mock-server-stale-process-gotcha` memory).

**Every base URL below is exported as a named constant from `misc/fixtures.ts`** — import the one(s) a spec needs alongside `expect`/`test` (e.g. `import { expect, test, HTTP_SERVER } from "../../misc/fixtures";`) and compose the path onto it (`` `${HTTP_SERVER}/post` ``) instead of hardcoding `localhost:<port>` inline. `misc/git-fixtures.ts` re-exports `GIT_SERVER` from `misc/fixtures.ts` itself (`GIT_SERVER as GIT_SERVER_URL`) the same way.

| Server                        | Constant(s)                                                                                       | Base URL                                                                                                                          | Use for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `misc/mock-api.js`            | `MOCK_API_SERVER`                                                                                 | `http://localhost:4010`                                                                                                           | Insomnia cloud API mock (session, AI, updates, Cloud Sync) — not usually targeted directly by test bodies. Three flags are mutable via admin routes rather than fixed responses: `PUT /_admin/features/git-sync`, `PUT /_admin/storage-rule/git-sync`, and `PUT /_admin/features/konnect-sync` (body `{ enabled: boolean }`), wrapped by `misc/fixtures.ts`'s `setGitSyncFeatureFlag()`/`setGitSyncStorageRule()`/`setKonnectSyncFeatureFlag()` — see the create-project dialog helpers above and the Konnect section above. Also serves `GET /mock-llm/models` (a static, always-on route, not a toggleable flag) — a fake OpenAI-compatible models list backing `MOCK_LLM_SERVER` (`${MOCK_API_SERVER}/mock-llm`), used by the AI Settings "url" backend's real "Load Models" fetch (see above). `POST /graphql` backs Cloud Sync's VCS API (see `cloudSyncFlow` above) — three fixture workspaces, same fake session/symmetric key `misc/fixtures.ts` already injects; `PUT /_admin/cloud-sync/new-commit` (body `{ enabled, sessionId, projectId? }` — `projectId` picks which fixture workspace's alternate snapshot history to serve, `"My Environment"`'s by default; see `CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS`) and `POST /_admin/cloud-sync/reset` (wrapped by `misc/fixtures.ts`'s `resetCloudSyncState()`) toggle its mutable state; `POST /_admin/cloud-sync/delay` (body `{ sessionId, ms, projectId? }`, wrapped by `setCloudSyncGraphQLDelay()`) holds every subsequent GraphQL response for the session by `ms` before replying — scoped to `projectId` when given, or every request otherwise — a concurrency-testing knob, not something `resetCloudSyncState()` clears (see `cloudSyncFlow` above). `GET /_admin/cloud-sync/request-log?sessionId=...` (wrapped by `getCloudSyncGraphQLRequestLog()`) reads back the same session's `requestLog: []` — every GraphQL request logged as `{ operationName, projectId, at }` at arrival time (before any delay hold), in order — for asserting the actual on-the-wire project id a request carried, not just its eventual effect on disk; **this one** *is* cleared by `resetCloudSyncState()`. Also backs the "Invite collaborators" dialog (see `organizationFlow` above) — `GET .../organizations/:id/collaborators` and its own per-session `collaboratorsBySession` state (keyed by the same `x-session-id` header the flags above use, so concurrent Playwright workers don't see each other's invites) start seeded with two members and one pending invite (`existing-collaborator-0/1/2@example.com`); `POST .../collaborators/start-adding` (body `{ emails: string[] }`) appends each as a new pending invite; `PATCH .../invites/:invitationId` and `PATCH .../members/:userId/roles` (body `{ roles: string[] }`) change a pending invite's or an existing member's role. `GET .../collaborators/search` always returns the same fixed list of 8 (`searchable-collaborator-0..7@example.com`) regardless of the query text — it doesn't actually filter server-side. Also backs the Vault Key flow (see `preferencesFlow` above) via `POST /v1/user/vault(/reset)`/`vault-verify-a`/`vault-verify-m1` — a **real SRP exchange** against `@getinsomnia/srp-js` (the exact same package/version the app itself uses), so an incorrect vault key genuinely fails server-side `checkM1()` rather than a canned rejection; state (the stored salt/verifier, any in-flight exchange) is isolated per `x-session-id` the same way Cloud Sync's is, and `POST /_admin/vault/reset` (wrapped by `misc/fixtures.ts`'s `resetVaultState()`, called before every launch) clears it. |
| `misc/echo-server.js`         | `HTTP_SERVER` / `HTTP_SERVER_HTTPS` / `HTTP_SERVER_CUSTOM_CA_HTTPS` / `HTTP_SERVER_MTLS`          | `http://localhost:4060` (+ `https://localhost:4061`/`:4062`/`:4063`, same routes)                                                 | HTTP echo — request/response assertions. Routes: `GET /cookies` (echoes cookies), `POST`/`QUERY /post` (httpbin-style echo — `QUERY` accepted alongside `POST` specifically for the `HttpMethod.Query` scenario, since raw Node `http` matches routes by exact `req.method`, not Express-style wildcard), `POST /posts` (jsonplaceholder-style create), `POST /graphql` (canned Rick & Morty response), `GET /v2/swagger.json` (serves `misc/fixtures/petstore-swagger.json`, whose own `host`/`schemes` point back at this server), `GET /v2/pet/:petId` (canned Pet, backs the imported doc's "Find pet by ID"), `POST /calculator.asmx` (SOAP Add), any other path/method combo → empty `{}` (e.g. `GET /post` still falls through to this fallback — only `POST`/`QUERY` are wired for that route). `HTTP_SERVER_HTTPS` serves the identical `handleRequest` over TLS with a self-signed cert (`misc/fixtures/localhost-cert.pem`/`localhost-key.pem`, CN=`localhost`) — call `preferencesFlow.set({ validateSSL: false })` before sending to it, or Insomnia rejects the cert. `HTTP_SERVER_CUSTOM_CA_HTTPS` (4062) serves a server cert signed by `misc/fixtures/mtls-ca.pem` instead of a bare self-signed one — rejected by Insomnia's default trust store until that CA is added via `certificatesFlow.setCaCertificate()`, at which point it's trusted **without** `validateSSL: false`. `HTTP_SERVER_MTLS` (4063) uses the same CA-signed server cert but additionally sets `requestCert: true, rejectUnauthorized: true` against that CA — the TLS handshake itself fails without a valid client certificate (verified live via plain `curl`/`openssl`, independent of the app), so a request needs both `validateSSL: false` (to skip trusting the server cert, same as `HTTP_SERVER_HTTPS`) **and** a client certificate added via `certificatesFlow.addClientCertificate()` signed by that same CA (`misc/fixtures/mtls-client-cert.pem`/`mtls-client-key.pem`) to succeed. `x-reply-delay-ms` delays every route uniformly (checked once at the top of `handleRequest`, before any route matching) on all four ports. |
| `misc/event-stream-server.js` | `EVENT_STREAM_SERVER` / `EVENT_STREAM_SERVER_HTTPS`                                               | `http://localhost:4050` (+ `https://localhost:4051`, same `handleRequest`)                                                        | SSE requests. `x-reply-delay-ms` delays the whole connection opening — before the "Starting Events" message, so a test can disconnect before any event arrives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `misc/ws-echo-server.js`      | `WS_SERVER` / `WS_SERVER_WSS`                                                                     | `ws://localhost:4040` (+ `wss://localhost:4041`, same connection handler)                                                         | WebSocket requests. `x-reply-delay-ms` is read once from the initial handshake request and delays both the "Request served by ..." banner and every echoed message by that amount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `misc/socket-server.js`       | `SOCKET_SERVER` / `SOCKET_SERVER_WSS`                                                             | `ws://localhost:3000` (+ `wss://localhost:3001`, same `io` instance via `io.attach()`)                                            | Socket.IO requests. `x-reply-delay-ms` is read once from `socket.handshake.headers` and delays every echoed event by that amount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `misc/mcp-server.js`          | `MCP_SERVER` / `MCP_SERVER_HTTPS`                                                                 | `http://localhost:4020/mcp` (+ `https://localhost:4021/mcp`, same Express app)                                                    | MCP client requests. `x-reply-delay-ms` delays the whole `/mcp` request before any tool handling — **not yet wireable from a test**, since `models/mcp-client.ts`'s `McpClient` has no `headers` field to set it from (server-side support is there for when that's added).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `misc/grpc-server.js`         | `GRPC_SERVER` / `GRPC_SERVER_TLS` / `GRPC_SERVER_MTLS`                                            | `localhost:9000` (paired with `misc/protos/`) (+ TLS on `grpcs://localhost:9001`, mTLS on `grpcs://localhost:9002`, same service) | gRPC requests. `hello.HelloService`: `SayHello` (unary, replies `hello <greeting>`; echoes an `x-test-header` metadata value into the reply if the request sends one — `hello <greeting> (<header value>)`; replies with `INVALID_ARGUMENT` if `greeting` is empty) · `LotsOfReplies` (server-streaming; splits `greeting` on `,` and writes one reply per name, throttled 50ms apart by default so an in-flight call can actually be cancelled — override via an `x-reply-delay-ms` metadata header, e.g. `1000`, to widen that window for a reliable cancel test) · `LotsOfGreetings` (client-streaming; joins every streamed greeting into one reply, `hello A, B, C`) · `BidiHello` (bidi-streaming; echoes each streamed message back individually). `GRPC_SERVER_MTLS` (9002) uses `createSsl(caCert, [{key, cert}], true)` — the third `checkClientCertificate` arg — so, like `HTTP_SERVER_MTLS`, the handshake itself fails without a valid client cert (verified live via `grpcurl`); needs `validateSSL: false` plus a `certificatesFlow.addClientCertificate()` signed by `misc/fixtures/mtls-ca.pem` to connect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `misc/git-server.js`          | `GIT_SERVER`                                                                                      | `http://localhost:4070`                                                                                                           | Git Sync requests. A real smart-HTTP git server (`git-http-backend` wrapping the system `git` binary), not a canned-response stub — no `x-reply-delay-ms` support. Basic auth `testuser`/`testpass` on every git protocol request (not the `/_admin` routes). `misc/git-fixtures.ts`'s `gitRepo` fixture creates a fresh bare repo per test (`PUT /_admin/repos/:name`, `{ seed: true }` seeds one empty commit on `master`) and tears nothing down itself (each test gets a unique `crypto.randomUUID()`-named repo). Admin routes used by `getServerBranches()`/`getServerCommits()`: `GET /_admin/repos/:name/branches`, `GET /_admin/repos/:name/commits?branch=master`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `misc/oauth2-server.js`       | `OAUTH2_SERVER` (+ `OAUTH2_CLIENT_ID`/`OAUTH2_CLIENT_SECRET`/`OAUTH2_USERNAME`/`OAUTH2_PASSWORD`) | `http://localhost:4080`                                                                                                           | OAuth 2.0 Auth-tab requests. A real (if minimal) OAuth2/OIDC provider — no login/consent screen, auto-approves any request for the fixed `CLIENT_ID`/`CLIENT_SECRET`/`USERNAME`/`PASSWORD` (mirrored 1:1 as the `misc/fixtures.ts` constants above). `GET /authorize` — Authorization Code redirects with `?code=...`, Implicit redirects with `#access_token=...`/`#id_token=...` in the fragment per grant/response type; real PKCE verification (`code_challenge`/`code_challenge_method` stored against the issued code, `code_verifier` checked at exchange — S256 via `sha256(verifier)` base64url, or plain equality). `POST /token` — all of `authorization_code`/`client_credentials`/`password`/`refresh_token`; client auth accepted either as a Basic header or `client_id`/`client_secret` in the body (mirrors the Auth tab's "Credentials" dropdown). `GET /resource` — a protected endpoint requiring `Authorization: Bearer <token>`, echoing the raw header back in its JSON body (`{ authorization: "Bearer ..." }`) so a spec can assert the exact token was actually sent, not just that _a_ 200 came back. `GET /_debug/last-token-request?access_token=<token>` — returns `{ grantType, clientId, pkceUsed, pkceMethod, pkceVerified }` for the `/token` exchange that issued that specific `access_token` (looked up by token, not "most recent", so concurrent specs each see only their own exchange), letting a spec assert what the server itself received/verified (not just what the UI displays afterward) — no `x-reply-delay-ms` support, and no reset endpoint (state is just per-process, same as every other mock server).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

All four protocol-server secure ports (SSE/WebSocket/Socket.IO/MCP) reuse `misc/fixtures/localhost-cert.pem`/`localhost-key.pem` (self-signed, CN=`localhost`, SAN `DNS:localhost,IP:127.0.0.1` — the same pair `echo-server.js` already used for its 4061). Insomnia's default `Settings.validateSSL` will reject them — call `preferencesFlow.set({ validateSSL: false })` before sending to any of `https://localhost:4051`, `wss://localhost:4041`, `wss://localhost:3001`, `https://localhost:4021`, or gRPC's `localhost:9001` TLS port. `misc/mock-api.js` (4010) intentionally has no secure port — it's Insomnia's own app-bootstrap/auth API mock, nothing in the app config points at an HTTPS variant of it, and it isn't a protocol test target the way the others are. The four **certificate-testing** ports (`HTTP_SERVER_CUSTOM_CA_HTTPS`, `HTTP_SERVER_MTLS`, `GRPC_SERVER_TLS`'s mTLS sibling `GRPC_SERVER_MTLS`) instead use a separate self-signed CA + server/client keypair set (`misc/fixtures/mtls-ca.pem`/`mtls-ca-key.pem`, `mtls-server-cert.pem`/`mtls-server-key.pem`, `mtls-client-cert.pem`/`mtls-client-key.pem`) specifically so a test can exercise "trust a custom CA"/"present a client cert" via `certificatesFlow` instead of blanket-disabling validation — see the Certificates-testing ports' own descriptions above and `certificatesFlow` above.

## `pageManager` helpers used directly from specs

```ts
// @throwOnDialog (misc/decorators.ts) decorates a Page method: run it, then wait up to `timeout`ms
// for a role="dialog" to appear — if one does, throw an Error with its trimmed text instead of returning.
// There is no separate "read the dialog" call; the decorated method's own promise rejects.
// RequestPage.send() and GrpcRequestPage.fetchServerReflection() carry it today, both using the decorator's default 1000ms (neither passes an explicit timeout).
// Assert with `.rejects.toThrow(...)` on the owning Flow call — see tests/environment/unlinked-environment-variable.spec.ts,
// tests/grpc-request/server-returns-business-error-status.spec.ts, tests/grpc-request/reflection-fails-on-unreachable-server.spec.ts.
pageManager.workspacePage.getNodes(): Promise<TreeNode[]>       // flattened tree, for asserting a node exists/was deleted/was imported
pageManager.responsePage.getEvents(): Promise<StreamEvent[] | undefined>  // live stream events, read inside a disconnect/callTool callback
pageManager.<domain>RequestPage.send()/connect()/disconnect(callback?, timeout?): Promise<void>
  // inherited from the shared pages/request.page.ts base — low-level; prefer <domain>RequestFlow.send()
  // unless you need to trigger it without navigating to the Response pane (e.g. asserting an
  // error dialog appears instead of a Response — see tests/environment/unlinked-environment-variable.spec.ts)
pageManager.<domain>RequestPage.setMethod(method: HttpMethod): Promise<void> / .getMethod(): Promise<string>
  // also inherited from pages/request.page.ts — no Flow method changes an already-created request's
  // method (only <x>RequestFlow.create()'s applyRequestFields() sets it once, at creation time), so
  // call these directly on pageManager when a scenario needs to switch method post-creation, e.g.
  // importing via curl then switching to HttpMethod.Query — see tests/http-request/query-method.spec.ts
pageManager.<domain>RequestPage.typeUrl(text: string): Promise<void>
  // clicks the URL bar, moves the cursor to the end, and types `text` via real keystrokes — builds
  // genuine CodeMirror undo history the way a user's typing would, unlike setUrl() (replaces the
  // value outright, no undo history behind it)
pageManager.<domain>RequestPage.undoUrl(): Promise<void>
  // clicks the URL bar and sends the platform's Undo shortcut (Cmd+Z on macOS, Ctrl+Z elsewhere) —
  // built on the shared BasePage.undo() helper below
pageManager.<domain>RequestPage.urlBarContainer: Locator
  // the URL bar editor's container element — pass to BasePage's hasFocus() below to check whether
  // the URL bar specifically is focused
pageManager.<domain>RequestPage.getUrlPreview(): Promise<string>
  // reads the `title` tooltip off the first rendered `{{ _.variable }}` tag in the URL bar (empty
  // string if none is rendered) — the tag's own resolved-value preview, refreshed whenever the
  // active environment changes even without re-navigating to the request
pageManager.<domain>RequestPage.setDocsMode(mode: "write" | "preview"): Promise<void>   // switches to the Docs tab, then its Write/Preview sub-tab
pageManager.<domain>RequestPage.getDocs(): Promise<string>            // switches to the Docs tab and reads its Markdown editor's current value
pageManager.<domain>RequestPage.typeDocs(text: string): Promise<void>
  // switches to the Docs tab's Write sub-tab, clicks its editor, moves the cursor to the end, and
  // types `text` via real keystrokes — same "build genuine undo history" shape as typeUrl()
pageManager.<domain>RequestPage.undoDocs(): Promise<void>  // clicks the Docs editor and sends the platform's Undo shortcut
pageManager.<domain>RequestPage.typeScripts(scripts: RequestScripts): Promise<void>
  // types into the Scripts tab's Pre-request and/or After-response editors via real keystrokes
  // (only whichever of scripts.preRequest/scripts.afterResponse is provided), unlike setScripts()
  // which replaces the value outright with no undo history behind it
pageManager.<domain>RequestPage.undoScript(which: ScriptTab): Promise<void>   // switches to that script's sub-tab, clicks its editor, sends the platform's Undo shortcut
pageManager.<domain>RequestPage.switchScriptTab(which: ScriptTab): Promise<void>  // switches to the Scripts tab, then to the PreRequest/AfterResponse sub-tab
pageManager.<any Page>.hasFocus(container: Locator): Promise<boolean>
  // BasePage-inherited by every Page class; reads the app's own `data-focused` attribute the app sets
  // on an editor's container on focus/blur (see one-line-editor.tsx) — more reliable than comparing
  // against document.activeElement across the Electron/iframe boundary. Only for a CodeMirror
  // editor's container (URL bar, a key/value row's Name/Value cell, the Docs/Scripts editors) — use
  // isFocused() below for anything else (a plain button, a react-aria textbox, a tab).
pageManager.<any Page>.isFocused(target: Locator): Promise<boolean>
  // BasePage-inherited; checks `target === document.activeElement` directly — for plain DOM elements
  // that aren't a CodeMirror editor (Send button, a Settings dialog's Name textbox, a tab). Confirmed
  // live these don't need hasFocus()'s data-focused workaround — no Electron/iframe indirection for them.
pageManager.<domain>RequestPage.sendButton: Locator   // the Send button — pass to isFocused(), not hasFocus()
pageManager.<domain>RequestPage.addParam(): Promise<Locator> / .addHeader(): Promise<Locator>
  // switches to the Params/Headers tab and clicks its "Add" button, appending a new blank row;
  // returns the new row's Name editor container — pass to hasFocus() to check whether it auto-focused
pageManager.environmentPage.blankRowNameContainer: Locator
  // the key/value pair listbox's trailing (last) row's Name editor container — for a brand-new,
  // still-empty environment this is also its only row — pass to hasFocus()
pageManager.<any Page>.undo(focus?: () => Promise<void>): Promise<void>
  // BasePage-inherited; sends the platform's Undo shortcut (Cmd+Z on macOS, Ctrl+Z elsewhere) to
  // whatever currently has focus — pass `focus` to click/focus the target editor first (what
  // undoUrl()/undoDocs()/undoScript() all do internally); omit it if the caller already focused it
```

Real example: `tests/workspace/url-bar-undo-survives-tab-switch.spec.ts` — types into the URL bar with `typeUrl()`, switches tabs away and back, confirms both the edited value and its undo history survive the switch, and that switching back does NOT leave the URL bar focused (checked via `hasFocus(httpRequestPage.urlBarContainer)`). `tests/workspace/url-bar-editor-characterization.spec.ts` — three narrower, tab-switch-independent characterizations ported from insomnia-smoke-test's `url-bar-undo.test.ts`: typing+undo keeps focus throughout, importing params from the URL stays undoable afterward, and switching the linked environment refreshes `getUrlPreview()`'s resolved value without re-navigating. `tests/workspace/editor-undo-survives-tab-toggle.spec.ts` — two `test.fail()`-documented app bugs, matching insomnia-smoke-test's own `editor-toggle-undo.test.ts` 1:1: the Docs editor's typed content loses its undo history across a Write/Preview sub-tab toggle, and a Pre-request script's typed content loses its undo history across a Pre-request/After-response sub-tab toggle — same "remount kills `OneLineEditor`/`CodeEditor` undo history" defect class as the URL bar's own tab-switch case, but here triggered by a sub-tab toggle within one still-open request rather than switching requests. **Root-caused, not a fresh bug**: the insomnia monorepo already merged a fix (`fix(undo): preserve editor undo/content when toggling markdown write/preview and request-script tabs (#10351)`, commit `78097cdc0`, 2026-08-11), but the installed `/Applications/Insomnia.app` this framework launched by default at the time (`INSOMNIA_BINARY` unset, pre-2026-09-07) was built 2026-07-23, before that fix landed — no ticket needed yet; re-run against a binary built after 2026-08-11 first, and only file one (per §9a) if it still fails there. **Since 2026-09-07 the default launch is dev-mode against the sibling `../insomnia` source checkout instead of a fixed installed build (see "App launch" above)**, so this version-gate no longer applies as stated — re-check whichever the sibling checkout has at HEAD before assuming this is still open.

`tests/workspace/request-pane-tab-order.spec.ts` — a freshly created request (via the raw `workspacePage.resolveNode()`/`rightClick()`/`clickContextMenu(ContextMenuItem.HttpRequest)` path, not `httpRequestFlow.create()`, which sets extra fields that blur the URL bar before a test could check it) focuses the URL bar, then Tab order flows Send → its dropdown → the Params tab (`data-focus-visible="true"`) → ArrowRight → the Body tab. Wait for `hasFocus(urlBarContainer)` to settle via `expect(...).toPass()` before pressing Tab — the URL bar's own initial-load remount (see `docs/undo-redo-baseline.md` in the insomnia monorepo) can otherwise steal focus back mid-sequence. `tests/workspace/auto-focus-rules.spec.ts` — two `test.fail()`-documented app bugs found while porting the rest of insomnia-smoke-test's `focus-and-keyboard.test.ts`: clicking "Add" on the Params/Headers tab never focuses the new row's Name cell (**INS-3587**), and selecting a brand-new empty environment never focuses its key/value editor's blank row Name cell (**INS-3588**) — both contradict `key-value-editor.tsx`'s own `autoFocus={pair.id === pendingFocusLastRowId}` intent, which has been in source since 2026-07-01 (predates the 2026-07-23 test binary), so unlike the undo bug above this looks like a genuine regression, not a stale-binary artifact.

## Existing spec files worth reading as patterns

Domain-specific facts already have their own "Real example: ..." pointer inline in the section above that covers them — this list is only for generic, cross-domain _techniques_ worth knowing before writing any new spec, regardless of which domain it's in.

- `tests/http-request/happy-path.spec.ts` / `tests/web-socket-request/happy-path.spec.ts` — canonical shapes: create → send → assert → duplicate → send-again for a plain request/response protocol; connect → send → disconnect-with-live-callback for a stateful one.
- `tests/mcp-client/happy-path.spec.ts` / `tests/workspace/rename-and-delete-project.spec.ts` — `expect.poll(...)` around an action's own async completion (node deletion, delete fetcher resolving), rather than asserting immediately after the click/dialog closes.
- `tests/environment/unlinked-environment-variable.spec.ts` / `tests/plugin/plugin-name-validation.spec.ts` — asserting an expected failure with `.rejects.toThrow(...)`, whether from a `@throwOnDialog`-decorated call or a Page method that throws once it's polled past a misleading static hint into the real async outcome.
- `tests/environment/sub-environment-variable-priority.spec.ts` — the `satisfies <Model>` object-literal convention in practice.
- `tests/document/custom-lint-ruleset/custom-lint-ruleset.spec.ts` — documenting a real app bug with `test.fail()` (§9a) instead of asserting the buggy behavior as if it were correct.
- `tests/git-sync/*.spec.ts` — pairing a UI-level assertion with an independent server-side ground-truth check (`getServerBranches()`/`getServerCommits()`), rather than trusting the app's own UI as the only source of truth.
- `tests/environment/json-raw-editor.spec.ts` / `tests/cloud-sync/discard-commit-push-and-restore.spec.ts` — verifying a write or revert actually persisted by reloading or re-navigating for a fresh read, instead of trusting an in-session read-back or an already-open editor's stale CodeMirror buffer.
- `tests/workspace/url-bar-undo-survives-tab-switch.spec.ts` — real keystrokes via `typeUrl()` (not `setUrl()`) to build genuine CodeMirror undo history, and checking focus state via the app's own `data-focused` attribute (`BasePage.hasFocus()`) instead of `document.activeElement`, which doesn't reliably cross the Electron boundary.
- `tests/preferences/vault-key-generation.spec.ts` — `test.extend({ vaultKey, vaultSalt })` to seed launch-time crypto state per spec (same `test.extend`-a-fixture-in-the-spec-file shape as `dataPath`/`skipOnboarding` above), backed by a mock server running a **real** crypto exchange (`@getinsomnia/srp-js`) rather than canned request/response pairs.
