# FirstRequestCreation — E2E Test Plan

**Source:** `packages/insomnia/src/ui/components/first-request-creation.tsx`
**Rendered by:** `packages/insomnia/src/routes/organization.$organizationId.project.$projectId._index.tsx` (line ~341)

## 1. Component overview

The "first request" / welcome pane shown at the top of the **project page** whenever the
**Projects** sidebar tab is active (`activeSidebarTab === 'projects'`). It is NOT gated on
the project being empty — it stays visible above the file grid even after collections exist.

It provides three ways to create a first request:
1. **Endpoint/cURL textbox** + **Create** button (or Enter, or the `⌘ N` shortcut).
2. **Quick-start examples** ("Not sure where to start?") — 5 buttons.
3. **Attach content** (paperclip) → Import modal.

A **collection selector** popover targets where the request lands. If no collection is
selected, a "My first collection" workspace is auto-created on first create.

### Two greeting states (driven by recent-request count)
- **< 3 recent requests** → heading `Welcome, <name>!`, sub-text *"We have a sneaking
  suspicion that you came here to send a request, so let's get started!"*, and the
  **"Not sure where to start?"** quick-start row.
- **≥ 3 recent requests** → heading `Welcome back, <name>!`, sub-text *"Today is a new day,
  we're rooting for you!"*, and a **"Jump back in"** row of recent-request shortcut buttons.

"Recent requests" are stored in `localStorage` under
`recent-project-requests:<projectId>` (max 5), filtered to requests that still exist
(`packages/insomnia/src/common/project.ts`). The threshold is `length >= 3`.

`greetingName = userSession.firstName || userSession.email.split('@')[0] || 'there'`.
In the smoke-test fixture this is **"Rick"** (heading "Welcome, Rick!").

### Live findings worth flagging
- **Pokemon quick-start differs from source.** Source code shows label *"List a pokemon"*
  and URL `.../pokemon/ditto`. The **running build** shows label **"List pokemon"** and URL
  **`https://pokeapi.co/api/v2/pokemon?offset=0&limit=10`** (method GET). Tests must assert
  the LIVE values; the spec below uses the observed values.
- **Invalid-URL almost never triggers the error toast.** `normalizeRequestUrl` prepends
  `http://` (via `setDefaultProtocol`) before `new URL()`. As a result strings like
  `not a valid url`, `!!!`, unicode, even `a b` all become *valid* (e.g.
  `http://not a valid url`) and a real request is created. The error toast only fires for
  inputs that stay invalid after prefixing — verified live with **`http://`** (alone).
- **Error toast is NOT `role=alert`.** `showToast` renders a React-Aria toast: a region
  `[role=region][aria-label="N notification."]` containing a `[role=alertdialog]` item with
  the title text. Default auto-dismiss = **3000 ms**, so assertions must be fast.
  Match by title text, e.g. `getByText('Enter a valid endpoint URL')`.
- **Invalid-cURL is an inline `<div>` (no role)**, NOT a toast: text
  *"Invalid cURL. Verify your input and try again."* (`div.mt-2.text-xs`). Typing again
  clears it (`onChange` resets the flag).
- **Two different Import-modal scopes:** the paperclip ("Attach content") opens the modal
  scoped to the selected **Workspace** (`Import to "<collection>" Workspace`); the
  "Import files" quick-start opens it scoped to the **Project** (`Import to "<project>" Project`).

## 2. Preconditions

- App launched via the smoke-test harness; logged in as the fixture user (greeting "Rick").
- Each test starts from a **fresh Local Vault project** so the pane renders in the
  "Welcome, Rick!" / "Not sure where to start?" state (mirrors `dashboard-interactions.test.ts`):
  ```ts
  await page.getByRole('button', { name: 'Create new Project' }).click();
  await page.getByText('Local Vault').click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Rick!' })).toBeVisible();
  ```
- Several scenarios mutate state (create collections / requests). Use a fresh project per
  test (or delete created projects/collections after) — do not rely on a shared project.
- Reuse `ProjectPage` / `WorkspacePage` from `packages/insomnia-smoke-test/playwright/pages`
  for project creation and the `getByTestId('workspace-breadcrumb-level-0')` back-navigation.

## 3. Verified-live locators (shared)

- Textbox → `getByRole('textbox', { name: 'Request endpoint or cURL input' })`
- Create  → `getByRole('button', { name: 'Create request', exact: true })`
  (label is `Create ⏎`; the accessible name is "Create request")
- Attach (paperclip) → `getByRole('button', { name: 'Attach content' })`
- Collection selector trigger → `getByRole('button', { name: 'Select target collection' })`
- Welcome heading → `getByRole('heading', { name: 'Welcome, Rick!' })`
- Welcome-back heading → `getByRole('heading', { name: 'Welcome back, Rick!' })`
- Quick-start buttons (substring names, verified live):
  - `getByRole('button', { name: 'Notion MCP Server' })`
  - `getByRole('button', { name: 'List pokemon' })`  (full a11y name "GET List pokemon")
  - `getByRole('button', { name: 'Lookup GitHub repository' })`
  - `getByRole('button', { name: 'Create OpenAPI spec' })`
  - `getByRole('button', { name: 'Import files' })`
- Inline cURL error → `getByText('Invalid cURL. Verify your input and try again.')`
- Error toast title → `getByText('Enter a valid endpoint URL')`
- Back to project → `getByTestId('workspace-breadcrumb-level-0')`

---

## 4. Scenarios

#### 4.1 Greeting + initial state on a fresh project  (P0)
**File:** `tests/smoke/first-request/welcome-initial-state.test.ts`
**Steps:**
1. Create a fresh Local Vault project (precondition snippet)
   - expect: heading `getByRole('heading', { name: 'Welcome, Rick!' })` visible
   - expect: text `/came here to send a request/` visible
   - expect: text `Not sure where to start?` visible
2. Inspect the textbox
   - expect: placeholder `/Enter an endpoint URL or paste cURL, or .+ for a new blank request/`
     (live value: `Enter an endpoint URL or paste cURL, or ⌘ N for a new blank request`)
3. Inspect Create button with empty input
   - expect: Create button is `disabled` (`toBeDisabled()`)
4. Inspect collection selector on an empty project
   - expect: selector trigger shows `New collection`
**Locators:** (verified live)
- Heading → `getByRole('heading', { name: 'Welcome, Rick!' })`
- Textbox → `getByRole('textbox', { name: 'Request endpoint or cURL input' })`
- Create  → `getByRole('button', { name: 'Create request', exact: true })`
- Selector → `getByRole('button', { name: 'Select target collection' })`

#### 4.2 Create request from URL — happy path (auto-creates collection)  (P0)
**File:** `tests/smoke/first-request/create-from-url-happy.test.ts`
**Steps:**
1. Type `https://example.com` into the textbox
   - expect: Create button becomes enabled (`toBeEnabled()`)
2. Click Create  (collection selector shows "New collection")
   - expect: URL navigates to `/workspace/<wrk>/debug/request/<req>` (regex
     `/\/workspace\/wrk_[a-f0-9]+\/debug\/request\/req_[a-f0-9]+/`)
   - expect: sidebar shows a collection row `My first collection` (auto-created)
   - expect: request method badge `GET`; URL editor contains `https://example.com`
**Notes:** verified live — first create with no collection selected creates a
`My first collection` workspace, then an HTTP request, then navigates.
**Locators:** (verified live)
- Textbox → `getByRole('textbox', { name: 'Request endpoint or cURL input' })`
- Create  → `getByRole('button', { name: 'Create request', exact: true })`
- Collection row → `getByRole('row', { name: 'My first collection' })` (in sidebar grid)

#### 4.3 Create request by pressing Enter in the textbox  (P1)
**File:** `tests/smoke/first-request/create-via-enter-key.test.ts`
**Steps:**
1. Type `https://example.org` into the textbox
2. Press `Enter` in the textbox
   - expect: navigates to a debug request view (`/debug/request/req_`)
   - expect: URL editor contains `https://example.org`
**Notes:** `onKeyDown` Enter handler calls the same `handleCreateRequest` as the button
(`event.preventDefault()` then create). Verified the click path live; Enter shares it.
**Locators:** Textbox + `getByRole('textbox', { name: 'Request endpoint or cURL input' }).press('Enter')`

#### 4.4 Whitespace-only input keeps Create disabled  (P1)
**File:** `tests/smoke/first-request/whitespace-input-disabled.test.ts`
**Steps:**
1. Fill the textbox with `'   '` (spaces only)
   - expect: Create button stays `disabled` (verified live — `trimmedInput` is empty)
2. Clear, then type a single non-space char
   - expect: Create button becomes enabled
**Locators:** Textbox + Create (shared above)

#### 4.5 Invalid endpoint URL surfaces error toast, no navigation  (P1)
**File:** `tests/smoke/first-request/create-invalid-url.test.ts`
**Steps:**
1. Type `http://` into the textbox
   - expect: Create button enabled (no client-side validation on the button)
2. Click Create
   - expect: NO navigation — URL stays on `/project/<proj>` (no `/workspace/...`)
   - expect: toast title text `getByText('Enter a valid endpoint URL')` appears
     (matches `/valid endpoint URL/`). Assert promptly (auto-dismiss ~3 s);
     prefer `await expect(...).toBeVisible({ timeout: 2500 })`.
**Notes (verified live):** the toast is a React-Aria toast (region
`[aria-label="N notification."]` → item `[role=alertdialog]`), NOT `role=alert`.
A plain string like `not a valid url` does NOT error (it becomes `http://not a valid url`
and creates a request) — only inputs invalid after prefixing (e.g. `http://`) trigger this.
**Locators:** (verified live)
- Textbox + Create (shared)
- Toast → `getByText('Enter a valid endpoint URL')`

#### 4.6 Non-URL string is accepted (protocol auto-prepended)  (P2)
**File:** `tests/smoke/first-request/create-nonurl-accepted.test.ts`
**Steps:**
1. Type `not a valid url`
   - expect: Create enabled
2. Click Create
   - expect: navigates to a debug request view (request IS created)
   - expect: URL editor contains the prefixed value (live: `http://not a valid url` → the
     editor normalizes/displays the encoded form). Assert navigation rather than exact text.
**Notes:** documents the surprising-but-real behavior found live via `setDefaultProtocol`.
Marked P2 because it encodes a quirk rather than a primary user flow.
**Locators:** Textbox + Create (shared)

#### 4.7 Invalid cURL shows inline error (not a toast), recovers on edit  (P0)
**File:** `tests/smoke/first-request/curl-invalid-inline-error.test.ts`
**Steps:**
1. Type `curl` (the bare word) into the textbox
   - expect: Create enabled (input matches `/^\s*\$?\s*curl(?:\s|$)/i`)
2. Click Create
   - expect: NO navigation (stays on `/project/<proj>`)
   - expect: inline error `getByText('Invalid cURL. Verify your input and try again.')` visible
   - expect: NO toast region present (this is an inline `<div>`, not `showToast`)
3. Type any additional character into the textbox
   - expect: the inline error disappears (`onChange` resets `curlParseError`)
**Notes (verified live):** error element is a plain `<div class="mt-2 text-xs ...">` with
no ARIA role; ancestry has no `[role=alert]`.
**Locators:** (verified live)
- Textbox + Create (shared)
- Inline error → `getByText('Invalid cURL. Verify your input and try again.')`

#### 4.8 Valid cURL paste creates a request  (P1)
**File:** `tests/smoke/first-request/curl-valid-create.test.ts`
**Steps:**
1. Type/paste a valid cURL, e.g. `curl https://example.com`
   - expect: Create enabled
2. Click Create
   - expect: navigates to a debug request view (`requestType: 'From Curl'`)
   - expect: URL editor reflects `https://example.com`
**Notes:** parsed via `window.main.parseImport(..., { importerId: 'curl' })`. Use a minimal
valid curl so the parser yields a `url`. (Confirmed parser path live via the GitHub
quick-start, which builds a curl and creates a GraphQL request.)
**Locators:** Textbox + Create (shared)

#### 4.9 Collection selector — pick existing collection  (P1)
**File:** `tests/smoke/first-request/collection-selector-pick.test.ts`
**Preconditions:** project already has ≥1 collection (e.g. run 4.2 first or import a fixture).
**Steps:**
1. Click the collection selector trigger
   - expect: popover dialog `getByRole('dialog', { name: 'Select target collection' })`
   - expect: heading `Where should we put your request?`
   - expect: listbox `getByRole('listbox', { name: 'Select target collection' })` with an
     `option` for the existing collection (e.g. `My first collection`), shown `[selected]`
   - expect: footer button `getByRole('button', { name: 'New Collection' })`
2. Select the collection option
   - expect: popover closes; trigger label updates to the chosen collection name
3. Type `https://api.example.com` and click Create
   - expect: navigates into THAT collection's workspace (request lands there, not a new one)
**Locators:** (verified live)
- Trigger → `getByRole('button', { name: 'Select target collection' })`
- Dialog  → `getByRole('dialog', { name: 'Select target collection' })`
- Listbox → `getByRole('listbox', { name: 'Select target collection' })`
- Option  → `getByRole('option', { name: 'My first collection' })`
- New Collection → `getByRole('button', { name: 'New Collection' })`

#### 4.10 Collection selector — empty state + New Collection dialog  (P1)
**File:** `tests/smoke/first-request/collection-selector-new.test.ts`
**Preconditions:** fresh project with no collections.
**Steps:**
1. Open the collection selector
   - expect: empty-state text `You have no collections, so a new one will be created for you by default.`
   - expect: `New Collection` footer button present
2. Click `New Collection`
   - expect: dialog `getByRole('dialog', { name: 'Create or update dialog' })`
   - expect: heading `Create a new Request Collection`
   - expect: name textbox `getByRole('textbox', { name: 'Name' })` (placeholder
     `Enter a name for your Request Collection...`)
   - expect: `Cancel` and `Create` buttons present
3. Click `Cancel`
   - expect: dialog closes; no collection created
**Locators:** (verified live)
- Trigger → `getByRole('button', { name: 'Select target collection' })`
- Empty state → `getByText('You have no collections, so a new one will be created for you by default.')`
- New Collection → `getByRole('button', { name: 'New Collection' })`
- Create dialog → `getByRole('dialog', { name: 'Create or update dialog' })`
- Name input → `getByRole('textbox', { name: 'Name' })`
- Cancel → `getByRole('button', { name: 'Cancel' })`

#### 4.11 Quick-start: Notion MCP Server creates an MCP workspace  (P1)
**File:** `tests/smoke/first-request/quickstart-notion-mcp.test.ts`
**Steps:**
1. Click `Notion MCP Server`
   - expect: navigates to a NEW workspace debug view; URL matches
     `/\/workspace\/wrk_[a-f0-9]+\/debug\/request\/mcp-req_[a-f0-9]+/`
   - expect: sidebar/breadcrumb shows workspace name `Notion MCP Server`
   - expect: server URL field shows `https://mcp.notion.com/mcp`
   - expect: an `Mcp Server Capabilities` grid is present
**Notes (verified live):** creates a fresh `scope: 'mcp'` workspace, independent of the
selected collection.
**Locators:** (verified live)
- Button → `getByRole('button', { name: 'Notion MCP Server' })`
- Capabilities grid → `getByRole('grid', { name: 'Mcp Server Capabilities' })`

#### 4.12 Quick-start: List pokemon creates a GET request  (P1)
**File:** `tests/smoke/first-request/quickstart-pokemon.test.ts`
**Steps:**
1. Click `List pokemon`
   - expect: navigates to a debug request view (`/debug/request/req_`)
   - expect: sidebar request row named `List pokemon`, method badge `GET`
   - expect: URL editor contains `https://pokeapi.co/api/v2/pokemon` (live full value:
     `https://pokeapi.co/api/v2/pokemon?offset=0&limit=10`)
**Notes:** if no collection selected, lands in an auto-created `My first collection`.
LIVE values differ from source — assert the live label/URL above.
**Locators:** (verified live)
- Button → `getByRole('button', { name: 'List pokemon' })`
- Request row → `getByRole('row', { name: /List pokemon/ })`

#### 4.13 Quick-start: Lookup GitHub repository creates a GraphQL request  (P1)
**File:** `tests/smoke/first-request/quickstart-github-graphql.test.ts`
**Steps:**
1. Click `Lookup GitHub repository`
   - expect: navigates to a debug request view
   - expect: request named `Lookup GitHub repository`, type GraphQL (badge `GQL`, method `POST`)
   - expect: URL editor contains `https://api.github.com/graphql`
**Notes (verified live):** built from an internal curl, parsed, submitted as
`requestType: 'GraphQL'`.
**Locators:** (verified live)
- Button → `getByRole('button', { name: 'Lookup GitHub repository' })`
- Request row → `getByRole('row', { name: /Lookup GitHub repository/ })`

#### 4.14 Quick-start: Create OpenAPI spec opens Design Document dialog  (P1)
**File:** `tests/smoke/first-request/quickstart-openapi-doc.test.ts`
**Steps:**
1. Click `Create OpenAPI spec`
   - expect: dialog `getByRole('dialog', { name: 'Create or update dialog' })`
   - expect: heading `Create a new Design Document`
   - expect: name textbox (placeholder `Enter a name for your Design Document...`)
   - expect: `Cancel` and `Create` buttons
2. (optional) Click `Create`
   - expect: navigates into a new design-document workspace
2b. (alternative) Click `Cancel`
   - expect: dialog closes, no document created
**Notes (verified live):** calls `onCreateDesignDocument('first-request-pane')` which opens
the create-document prompt (does not immediately navigate).
**Locators:** (verified live)
- Button → `getByRole('button', { name: 'Create OpenAPI spec' })`
- Dialog → `getByRole('dialog', { name: 'Create or update dialog' })`
- Name input → `getByRole('textbox', { name: 'Name' })`

#### 4.15 Quick-start: Import files opens the project-scoped Import modal  (P1)
**File:** `tests/smoke/first-request/quickstart-import-files.test.ts`
**Steps:**
1. Click `Import files`
   - expect: dialog `getByRole('dialog', { name: 'Modal' })`
   - expect: text `/Import to ".+" Project/` (scoped to the project, e.g.
     `Import to "Personal Workspace" Project`)
   - expect: radio group with `File` (checked), `Url`, `cURL`, `Clipboard`, `MCP`
   - expect: `Scan` button present
2. Click `Modal Close Button`
   - expect: dialog closes
**Locators:** (verified live)
- Button → `getByRole('button', { name: 'Import files' })`
- Dialog → `getByRole('dialog', { name: 'Modal' })`
- Close → `getByRole('button', { name: 'Modal Close Button' })`
- File radio → `getByRole('radio', { name: /File/ })`

#### 4.16 Attach content (paperclip) opens the workspace-scoped Import modal  (P1)
**File:** `tests/smoke/first-request/attach-content-import.test.ts`
**Preconditions:** project has a collection so the selector shows a workspace name
(otherwise modal scopes differently). Run 4.2 first, or import a fixture.
**Steps:**
1. Click the paperclip `Attach content`
   - expect: dialog `getByRole('dialog', { name: 'Modal' })`
   - expect: text `/Import to ".+" Workspace/` (scoped to the selected collection, e.g.
     `Import to "My first collection" Workspace`)
   - expect: radio group `File` (checked) / `Url` / `cURL` / `Clipboard` / `MCP`; `Scan` button
2. Click `Modal Close Button`
   - expect: dialog closes
**Notes (verified live):** distinct from 4.15 — the paperclip scopes to the selected
**Workspace**, the quick-start "Import files" scopes to the **Project**.
**Locators:** (verified live)
- Paperclip → `getByRole('button', { name: 'Attach content' })`
- Dialog → `getByRole('dialog', { name: 'Modal' })`
- Close → `getByRole('button', { name: 'Modal Close Button' })`

#### 4.17 Keyboard shortcut (⌘ N) creates a blank request  (P1)
**File:** `tests/smoke/first-request/shortcut-new-blank-request.test.ts`
**Steps:**
1. Focus the textbox (leave it empty) and press the `request_createHTTP` shortcut
   (macOS `Meta+n`; resolve from `settings.hotKeyRegistry.request_createHTTP` /
   the placeholder display)
   - expect: navigates to a debug request view (`/debug/request/req_`)
   - expect with no collection selected: a `My first collection` is auto-created (the
     shortcut submits `withRequest: true`); with a collection selected, the request lands
     in that collection
**Notes (verified live):** with `My first collection` selected, `Meta+n` created a new
blank HTTP request in that workspace and navigated. The placeholder advertises the shortcut.
**Locators:** (verified live)
- Textbox → `getByRole('textbox', { name: 'Request endpoint or cURL input' })`
  then `.press('Meta+n')` (or platform equivalent)

#### 4.18 "Welcome back" / "Jump back in" state (≥3 recent requests)  (P2)
**File:** `tests/smoke/first-request/welcome-back-jump-in.test.ts`
**Preconditions:** the project's `recent-project-requests:<projectId>` localStorage entry
must list ≥3 EXISTING request IDs. Two ways to set this up:
- Functional: create/open ≥3 requests in the project so they get recorded, then return to
  the project page; OR
- Seed directly (used during exploration): build 3 valid `{ requestId, workspaceId }`
  entries and `localStorage.setItem('recent-project-requests:<projectId>', JSON.stringify({ recentRequests: [...] }))`,
  then navigate back to the project page to re-mount the pane.
**Steps:**
1. With ≥3 recent requests, view the project page
   - expect: heading `getByRole('heading', { name: 'Welcome back, Rick!' })`
   - expect: text `/Today is a new day, we’re rooting for you/`
   - expect: text `Jump back in`
   - expect: `Not sure where to start?` is NOT visible (quick-start hidden)
   - expect: ≥3 recent-request shortcut buttons (each: method badge + request name)
2. Click one "Jump back in" button (e.g. `GET List pokemon`)
   - expect: navigates to that request's debug view
     (`/workspace/<wrk>/debug/request/<thatReqId>`)
**Notes (verified live):** seeded 3 valid request IDs → heading flipped to "Welcome back,
Rick!" with a 3-button "Jump back in" row; clicking a button navigated to that request.
Marked P2 because reaching the state needs localStorage setup beyond the basic UI.
**Locators:** (verified live)
- Heading → `getByRole('heading', { name: 'Welcome back, Rick!' })`
- Jump-back button → `getByRole('button', { name: 'GET List pokemon' })` (name = badge + title)
