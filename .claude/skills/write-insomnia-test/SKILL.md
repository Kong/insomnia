---
name: write-insomnia-test
description: Use when writing, adding, or modifying a Playwright E2E test case (tests/**/*.spec.ts) for the Insomnia desktop app in this repo. Converts a short plain-language scenario ("test that X happens when Y", "write a test that verifies...") into an accurate spec file built from the existing Model/Flow/Page/enum layers. Trigger whenever the user asks to add/write a test case, a happy-path, or an edge-case spec for any protocol (http/graphql/grpc/websocket/socket.io/event-stream/mcp-client), the Collection Runner, cookie, environment, import, export, template tags, git sync, cloud sync, plugins/script sandbox, organization/invite collaborators, legacy database migration, or preferences (vault key, cloud/vault-provider credentials).
---

# Writing an Insomnia E2E Test Case

## Core rule: reuse before you invent

This repo is strictly layered: `tests/*.spec.ts` → `flows/*.flow.ts` → `pages/*.page.ts` → `models/*.ts` (see `TESTING.md` at the repo root for the full architecture). Writing a new test case almost never requires new Page/Flow/Model code — it's just composing existing methods in a spec file.

**Before writing any code, open `reference.md` in this skill folder** and confirm, for the domain involved: the Flow's exact method signatures, the Model's exact fields, and the mock server URL to hit. Do not call a method or pass a field from memory/guesswork — the single most common accuracy failure in this framework is inventing a Flow method or Model field that doesn't actually exist. If `reference.md` doesn't cover something you need, grep the actual `flows/`/`models/`/`pages/` file before writing the call.

## Prefer Flow methods over direct Page access

When a step can be done through a `xxxFlow` method, call that — never reach for the equivalent `pageManager.xxxPage` method just because it's more direct. A Flow method already sequences the right Page calls (and any related field the action implies — e.g. `HttpRequestFlow.create()` also applying auth/params/headers, not just the URL) in the order the app actually expects; composing a spec straight out of Page calls risks silently skipping or reordering a step the Flow would have handled correctly. This is also why a genuinely new spec almost always destructures a Flow instance first and a Page instance only if step 3 shows the action has no Flow wrapper — never the other way around.

Call `pageManager.xxxPage` directly only for the specific action `reference.md` shows has no Flow method covering it (e.g. `pageManager.<domain>RequestPage.setMethod()` — no Flow method changes an already-created request's method) — and only that one call, not the surrounding sequence a Flow method already exists for.

## Scope constraint: `tests/` only, nothing lower-layer — except a genuine bug

This skill **only creates or edits files under `tests/`** (a `*.spec.ts` file, or a scratch `_probe*.spec.ts` that gets deleted before finishing). It never creates or modifies `flows/*.flow.ts`, `pages/*.page.ts`, `models/*.ts`, `enums/*.ts`, anything under `misc/` (including mock servers/fixtures), or the registrations in `pages/page-manager.ts`/`flows/flow-manager.ts` — **with one exception, below.**

If the requested scenario can't be built from what already exists in those layers — no Flow method, Page method, or Model field covers the needed action — **stop and tell the user exactly what's missing** (the specific method/field/UI interaction that doesn't exist yet) instead of adding it. Let the user decide whether to build that layer code themselves, ask for it as a separate explicit task, or narrow the scenario to something already composable. This overrides step 4 below wherever the two would otherwise conflict.

**Exception: a genuine bug in an existing Flow/Page method.** "Missing" and "broken" are different situations, and only the first one is off-limits:

- **Missing (still stop and report, per above)**: no Flow/Page method exists for the action at all, or the closest one was never designed to handle this input/scenario. There's no established correct behavior to restore — building it is a design decision that belongs to the user.
- **Broken (fix it directly)**: a Flow/Page method exists, is the right one for this action, and demonstrably fails to do what its own name/signature/doc already promise — e.g. a `setBody()` that silently no-ops instead of writing the value, a getter that returns stale/wrong data, a wrong selector that clicks the wrong element, a method that throws on an input it's clearly supposed to accept. Restoring the already-intended behavior isn't a scope decision, so this skill may fix it in-place in `flows/*.flow.ts`/`pages/*.page.ts` — and, only if the fix strictly requires it, a minimal corresponding change in `models/*.ts` (e.g. a field the existing method already needs to read/write correctly) — never `enums/*.ts` or `misc/*` under this exception.
- Before treating something as "broken" rather than "missing," confirm it with a probe (step 6) — don't assume a bug from a single failed call; check whether the method was ever meant to support this case at all.
- Keep the fix minimal and targeted at the demonstrated bug only — no refactors, no unrelated cleanup, no adding new methods/parameters "while you're in there." That would be a new capability, which falls back under the Missing case above.
- Always surface it: tell the user what was broken (file/line, the wrong behavior observed) and what you changed, as its own callout — don't let it blend silently into "wrote the test." A framework-layer change affects every other spec that touches that method, so it needs to be visible, not incidental.

## Fixture rule: only inject `user`

Every test takes exactly one fixture parameter: `async ({ user }) => {...}`. Never destructure `workspaceFlow`, `httpRequestFlow`, `pageManager`, etc. directly in the test's parameter list — those per-flow fixtures no longer exist in `misc/fixtures.ts` at all (its `Fixtures` type only declares `dataPath`/`skipOnboarding`/`vaultKey`/`vaultSalt`/`insomnia`/`window`/`user`), so destructuring them would fail to type-check, not just be discouraged. Instead, pull what you need out of `user` at the top of the test body:

```ts
test("...", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager; // Flow instances live here
  const { pageManager } = user;                                // only if you need direct Page access
  ...
});
```

`user` is `{ page, pageManager, flowManager }` (see `misc/fixtures.ts`); every domain's Flow is a getter on `flowManager` (`user.flowManager.workspaceFlow`, `user.flowManager.eventStreamRequestFlow`, ...).

## Workflow

### 1. Turn the request into four concrete facts

User prompts are often short ("test environment variable overrides", "add a test for gRPC error handling"). Before writing anything, pin down:

- **Domain**: which protocol/feature (http / graphql / grpc / websocket / socket.io / event-stream / mcp-client / runner / cookie / environment / import / export — and if import, which source: file/url/curl/clipboard/mcp)?
- **Preconditions**: what entities must exist first (Project, Collection, Environment, linked Cookie, ...) and in what state?
- **Action**: what does the user actually do (send, connect, disconnect, duplicate, import, call a tool, link an environment/cookie...)?
- **Expected outcome**: what gets asserted (response body/status/headers, a UI node appearing/disappearing, dialog text, a stream event, a deleted node)?

If any of the four is genuinely ambiguous (protocol unclear, exact expected error text unspecified), ask a short clarifying question rather than guessing. Otherwise, proceed — don't ask about things `reference.md` already answers.

### 2. Check existing coverage before writing anything new

Before deciding on a file name or writing any code, decide in this priority order — each option wins over the ones below it — because the goal is fewer, denser spec files over a pile of near-duplicates that all pay the same app-launch/teardown cost:

1. **Already covered** — an existing test already exercises the same test point (same precondition + action + expected outcome, even if worded or named differently). Stop, don't add a new file or edit anything, and tell the user which existing spec already covers it.
2. **Easy to extend** — the new test point can be folded into an existing test with a small, natural change: another `kvPairData` entry, another item in an existing loop of inputs/params, another assertion on a response the test already fetches, a slightly broadened one-sentence test name that still honestly describes what the test now does. **When this is possible, prefer it over writing a new file** — even if the result isn't byte-for-byte the test's originally-written intent, a low-effort edit that keeps the test coherent and its name accurate counts as reuse, not scope creep.
3. **New file** — only when neither of the above applies: the scenario needs a materially different precondition, a different action, or a differently-shaped expected outcome that can't be folded into an existing test without contorting it (a second unrelated assertion block, forcing in an unrelated setup path, a name that would need "and" to stay honest). Place it per step 7 in that case.

- Find candidates by listing and skimming existing specs under `tests/<domain>/` (and `tests/data/import/<source>/`/`tests/data/export/` for import/export scenarios) — `ls tests/<domain>/`, then `Read` any file whose name or content sounds related to the requested scenario.
- **Never merge two genuinely distinct scenarios into one test just to cut file count.** Option 2 is for widening a test's existing test point with more data or assertions of the same shape, not for bolting an unrelated behavior onto it. If the fold would need a second, differently-shaped assertion block or a different action entirely, that's two test points — use option 3, per the single-sentence-intent rule (step 8); a broken assertion should always tell you unambiguously which behavior regressed.
- When reuse or extension applies, say so in the TodoWrite plan (step 5) as "edit existing file X to also cover Y" rather than "create new file," and skip step 7's file-naming step for that scenario.

### 3. Look up the domain in `reference.md`

Find the domain's row/section: the Flow property name on `flowManager`, the Flow file, the Page file, the Model file, and the exact method signatures already available (create/send/connect/disconnect/get/link/duplicate/delete/...).

### 4. Decide: pure composition, missing layer code, or an existing bug?

- If the needed action is already a Flow method and it works as documented → call the Flow method, not the underlying Page method directly (see "Prefer Flow methods over direct Page access" above).
- If it genuinely requires a new UI interaction with no existing Flow method → **per the Scope Constraint above, this skill does not add it.** Stop, name the exact gap (e.g. "no Flow method disconnects and reconnects a WebSocket request — closest is `disconnect()`, which doesn't reopen the connection"), and let the user decide how to proceed instead of extending Model/Page/Flow yourself.
- If the right Flow/Page method already exists but doesn't do what it claims (a genuine bug, not a missing feature) → this is the one case the Scope Constraint's exception covers. Confirm it's really broken (not just unsupported) via step 6, fix it minimally in place, and report the bug and the fix to the user.
- Never hand-write `test.step(...)` — every Page/Flow method is auto-instrumented by `misc/step-instrumentation.ts`.

### 5. Write out the plan and reasoning, then track it with TodoWrite

Before touching any file, write the concrete plan as a TodoWrite list: which spec file(s) change (new file, or an edit to an existing one per step 2), and *why* each step is needed.

This matters most exactly when step 4 turns up a gap: that's where it's tempting to just quietly patch `flows/`/`pages/`/`models/` to make the test work (a body-type test wanting a native file-dialog stub; a "secure cookie" test wanting an HTTPS mock server). Per the Scope Constraint, don't — write down what's missing instead, and surface it to the user (see `AskUserQuestion`) before writing any spec code that depends on it. Some past gaps already got filled outside this skill and are now composable — e.g. `preferencesFlow`/`misc/echo-server.js`'s port 4061, or `HttpMethod.Query` + `misc/echo-server.js`'s `/post` route accepting it (surfaced via `AskUserQuestion`, then filled as an explicit separate step — see `tests/http-request/query-method.spec.ts`) — see `reference.md`, so check there first; a gap only warrants stopping if `reference.md` and the real `flows/`/`pages/` files genuinely don't cover it yet. As of the last update, **every** protocol mock server now has a secure counterpart too (SSE/WebSocket/Socket.IO/MCP/gRPC — not just HTTP echo), all sharing the same self-signed cert and requiring the same `preferencesFlow.set({ validateSSL: false })` call — see the Mock servers table in `reference.md`.

This is distinct from a genuine bug (per the Scope Constraint's exception): a gap has nothing to restore (no established correct behavior was ever built), while a bug means the method already promises behavior it isn't delivering. When step 4 identifies a bug rather than a gap, the plan should say so explicitly — e.g. "fix bug in `pages/graphql-request.page.ts`'s `setBody()` (silently no-ops), then write the spec" — so it's visible as its own line item, not folded silently into "write the spec."

Keep the todo list updated as you go (mark items in_progress/completed in real time) — it's also what lets you resume correctly if the conversation is compacted mid-task.

### 6. Probing the real app (investigation only — confirming a bug is in scope, adding new capability never is)

`reference.md` and the source files describe *what* a Flow/Page method does, not always *how it behaves live* (timing, debounce, exact error text). If you need to confirm that before composing a test — or need to precisely describe a gap found in step 4 back to the user, or need to confirm a suspected bug is real before invoking the Scope Constraint's exception — write a short throwaway spec (e.g. `tests/<domain>/_probe.spec.ts`) that drives the flow with raw Playwright calls on `user.page` directly, and after each step print out what actually happened via plain `console.log`. Run it for real:

```
npx playwright test tests/<domain>/_probe.spec.ts --reporter=list
```

Use it to confirm an *existing* method's real behavior, to gather concrete detail for the "here's what's missing" report in step 4, or to pin down exactly where and how an existing method misbehaves before fixing it. It's never a stepping stone to writing *new* Page/Flow capability yourself, per the Scope Constraint — only to confirming what's already there, working or not. If it confirms a bug and you fix it, re-run the same probe afterward to confirm the fix actually restores the intended behavior before moving on to the real spec. **Delete every `_probe*.spec.ts` file before finishing** (checked in step 11); it's a scratch tool, never a committed test.

**On a timeout (or any step whose failure mode is unclear from the error message alone), capture page state immediately** instead of re-running blind — a Playwright timeout error tells you *that* a locator/action didn't resolve, not *why*; the live DOM and a screenshot usually show it in one shot (wrong selector, a dialog blocking input, the app on an unexpected screen, a still-loading spinner). Wrap the step under suspicion in try/catch and dump both on catch:

```ts
import * as fs from "fs"; // add alongside the spec's other imports

try {
  await pageManager.xxxPage.someAction();
} catch (e) {
  const dir = "/path/to/this/session's/scratchpad"; // never tests/ — these are debug artifacts, not fixtures
  await user.page.screenshot({ path: `${dir}/probe-failure.png`, fullPage: true });
  fs.writeFileSync(`${dir}/probe-failure.html`, await user.page.content());
  console.log("PROBE_FAILURE", String(e));
  throw e;
}
```

Save both files to the scratchpad directory (never under `tests/` — they're debug artifacts, not fixtures), then `Read` the HTML file and the screenshot right away as part of the same turn — don't just log that they were captured and move on. The point is to go straight from "it timed out" to a concrete diagnosis (missing `data-testid`, an unexpected dialog, a route that never resolved) in the same investigation pass, before deciding whether step 4's gap/bug call applies.

Skip this step when nothing about the real app's live behavior is in question.

### 7. Place and name the file

- This step only applies once step 2 has concluded the scenario needs a genuinely new file — don't re-decide placement for something you're extending in place.
- Main path (create → act → assert, the "everything works" case): `tests/<domain>/happy-path.spec.ts`. If one already exists for that domain, do not overwrite it with a different scenario — add a new, separately named file instead (a same-intent extension belongs under step 2, not here).
- Edge case / error scenario: `tests/<domain>/<scenario-described-in-kebab-case>.spec.ts` — name the file after the scenario itself (e.g. `unlinked-environment-variable.spec.ts`), never `test1.spec.ts` or similar.
- `tests/data/import/` and `tests/data/export/` sit together under `tests/data/` since both drive Preferences -> Data; `tests/data/import/` is further split by source: `file/`, `url/`, `curl/`, `clipboard/`, `mcp/`.
- **If the test needs a fixture file** (a JSON/YAML/WSDL/etc. imported or read via `path.join(__dirname, "...")`), give the spec its own directory named after the spec file (without `.spec.ts`), and put the spec and every fixture it uses inside that directory together — e.g. `tests/data/import/file/import-open-api/import-open-api.spec.ts` + `tests/data/import/file/import-open-api/httpbingo-get.json`. Adjust the relative import depth to `misc/fixtures`/`enums/`/`models/` by one extra `../` versus a plain domain-level spec, since the file now sits one directory deeper. A spec with no fixture stays a plain file directly under `tests/<domain>/` (or `tests/data/import/<source>/`) — don't create a directory for it.

### 8. Follow this skeleton

```ts
import { expect, test } from "../../misc/fixtures"; // adjust relative depth to the actual file location
import { faker } from "@faker-js/faker";
import { ProjectType } from "../../enums/project-types";
import { Project } from "../../models/project";
import { Collection } from "../../models/collection";
// ...import the domain's enums/models as needed, per reference.md

test("<one sentence, imperative, e.g. 'Verify XXX'>", async ({ user }) => {
  const { workspaceFlow, xxxRequestFlow } = user.flowManager; // pull exactly the flows reference.md lists for this domain
  const { xxxPage } = user.pageManager; // only if you need direct Page access (e.g. no Flow method covers it) — name the exact Page(s), never the whole object

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  // 1. create whatever the scenario needs (Environment / Request / McpClient / Cookie link ...)
  // 2. trigger the action
  // 3. assert everything here, once, after steps 1-2 have fully run — see "Assertion style" below
});
```

Rules that apply to every test:

- Every variable name/string that could collide across tests (project/collection/request names, custom header values, etc.) must come from `faker` (`faker.string.alphanumeric(10)` and friends) — never hardcode.
- Every fixed UI value (HTTP method, content type, project type, context-menu item, import source) must come from `enums/`, never a magic string.
- Every mock-server base URL (`http://localhost:4060`, `ws://localhost:4040`, `localhost:9000`, etc.) must come from `misc/fixtures.ts` (`HTTP_SERVER`, `WS_SERVER`, `GRPC_SERVER`, ...), never hardcoded — import it alongside `expect`/`test` and compose the path onto it, e.g. `` `${HTTP_SERVER}/post` ``. See the Mock servers table in `reference.md` for the full constant list.
- When asserting the shape of a constructed object, use `satisfies <Model>` (not `as`) so TypeScript catches misspelled/nonexistent fields at write time — see the real example in `tests/environment/sub-environment-variable-priority.spec.ts:58`.
- Model fields are exactly what's in `models/*.ts` / `reference.md` — don't add fields "because it seems logical."
- **Prefer a plain object literal over `new <Model>(...)` for every Model whose constructor takes a single init object** — `Settings`, `Environment`, `HttpRequest`/`GraphQLRequest`/`GrpcRequest`/`WebSocketRequest`/`SocketIORequest`, `Cookie`, etc. (e.g. `{ validateSSL: false }`, not `new Settings({ validateSSL: false })`; `{ name, kvPairData: [...] }`, not `new Environment({ name, kvPairData: [...] })`). `new <Model>(...)` is only correct for the handful of Models with *positional* constructor args instead of an init object — `Project`, `Collection`, `Document`, `McpClient` (e.g. `new Project(name, ProjectType)` above) — those have no literal equivalent. See the full rule in `reference.md`.
- **Never add comments to the spec file.** The test name plus the composed Flow calls should read clearly on their own; don't explain *what* a step does or *why* an edge case exists in a `//` comment above it — that belongs in the PR description or commit message, not the file. (The `// adjust relative depth...` and numbered `// 1./2./3.` comments in the skeleton below are annotations for *this document*, describing the skeleton to you — never copy them literally into a real spec file.)
- **Never destructure the whole `pageManager` or `flowManager` object** (`const { pageManager } = user;` / `const { flowManager } = user;`) just to reach `pageManager.xxxPage.method()`/`flowManager.xxxFlow.method()` inline later — that pierces through the wrapper only to shorten nothing and hides which Pages/Flows the test actually touches. Always destructure the exact named instances you need at the top, the same way for both: `const { xxxRequestFlow } = user.flowManager;` and `const { xxxPage } = user.pageManager;`, then call `xxxPage.method()` directly. Same rule for one-off inline access — never `user.pageManager.xxxPage...`/`user.flowManager.xxxFlow...` reached for mid-body; pull it into the top-of-test destructuring instead, even for a single use.

### 9. Assertion style

- **If the user's request doesn't explicitly say what to assert, ask before writing any assertion — every time, regardless of what else is being clarified.** A short scenario like "test that duplicating a request works" names the action but not the expected outcome — don't silently guess and don't skip assertions either. Ask a short clarifying question (`AskUserQuestion`), proposing the assertions you'd add based on your own understanding of the feature (e.g. "I'll assert the duplicated request appears as a sibling node with a '(Copy)' suffix and that its body/headers match the original — anything else to check?") so the user can confirm or adjust rather than spec it out from scratch. Once confirmed, write the final assertion block from **both** the user's answer and your own understanding of the feature's correct behavior — don't narrow it to only the single field the user happened to name if the feature obviously implies more (e.g. a "send succeeds" scenario usually means status code *and* body shape, not status alone). This is a sharper version of step 1's "ask if the expected outcome is ambiguous" rule, specific to deciding the assertion block's contents.
  - **This must always be its own standalone `AskUserQuestion` call — never folded into another question's options as a side detail** (e.g. don't bury "I'll also assert X and Y" inside a scenario-selection option's description and treat a pick on that option as assertion sign-off). If step 1 or step 4 also needs a clarifying question in the same turn (which scenario/scope to build), ask that as a separate question first, then ask the assertion list as its own follow-up question once the scenario is settled — one question, one decision.
  - The confirmed assertion list is then fixed: don't silently drop, add, or swap an item when writing the actual `expect` block. If you realize mid-write that an item from the confirmed list isn't feasible (or a new one should be added), go back and ask about that specific change before writing it — don't just change the code and mention it only if asked.
- **All `expect` calls go at the end of the test, after every action step has already run** — don't assert immediately after each individual create/send/click to "check as you go." Run the full sequence of steps first, then verify outcomes in one block at the end. The point of the test is to prove the whole sequence produced the correct end state; a mid-test assertion only proves one step looked right in isolation, and gives a false sense that everything up to that point is validated when what actually matters is the final composition. If a helper's return value is needed for a later step (e.g. an id), capture the variable without asserting on it — assert on it (or on it again, folded into the final block) only at the end.
  - The one exception: a check that can *only* be observed while a resource is still live (a stream event arriving during an open connection, output inside a `disconnect`/`callTool` callback) isn't a "middle check" of a prior step — it's the only place that observation can be made at all, so it belongs inside that callback, not hoisted to the end of the test body.
  - **A second exception: `Response.console`/`.events`/`.tests` (`ResponsePage.get()`'s callback-typed fields) read whatever the response pane currently shows at call time, not a snapshot of what it showed when that particular `Response` was captured.** That's safe to defer to the end when the test only ever holds one `Response` at a time, or when several came from the *same* live connection's cumulative timeline (WebSocket/Socket.IO connect→send→disconnect, where events only ever append). It's **not** safe once the test sends more than one distinct request/response and later actions have already moved the pane on to a newer one — calling an earlier response's `.console()`/`.events()`/`.tests()` at the end then silently reads the *later* response's data instead (a hard failure, or worse, a false pass if the two happen to look alike). In that situation, verify each response's callback field immediately after the `send()`/action that produced it — right before the next request is created — even though it's still wrapped in `expect.poll(...)`. This isn't "check as you go" for its own sake; it's the only point at which that particular response's data is still the one on screen. Real examples: `tests/http-request/custom-ca-root-certificate.spec.ts`, `tests/http-request/mtls-client-certificate.spec.ts`.
- Already-settled state (response body, status code, header list): assert directly with `expect(x).toBe/toEqual/toMatchObject(...)`.
- **UI state that may lag** (a node not yet gone/appeared, a stream event not yet arrived): always poll, never a bare fixed `waitForTimeout` used as a wait-for-result mechanism:
  ```ts
  await expect.poll(async () => { ... }, { timeout: 10000 }).toEqual(...);
  ```
  or `await expect(async () => { ... }).toPass({ timeout: 10000 });` when the check itself is a multi-step callback rather than a single value.
- **A dialog popped by an action that's expected to fail** (e.g. an unresolvable environment variable, an unreachable server, a business-error status) is not something you poll for — the Page method that triggers it is decorated with `@throwOnDialog` (`misc/decorators.ts`), so the call itself rejects with an `Error` whose message is the dialog's trimmed text. Assert with `.rejects.toThrow(...)`, not by reading dialog text after the fact:
  ```ts
  await expect(httpRequestFlow.send(request)).rejects.toThrow(
    /environment variable is missing.*unlinked/s,
  );
  ```
  Real examples: `tests/environment/unlinked-environment-variable.spec.ts`, `tests/grpc-request/server-returns-business-error-status.spec.ts`, `tests/grpc-request/reflection-fails-on-unreachable-server.spec.ts`. Only `RequestPage.send()` and `GrpcRequestPage.fetchServerReflection()` carry this decorator today — check the target Page file before assuming a given action has it.
- For protocols where an assertion must happen *while* a connection is still open (WebSocket/Socket.IO disconnect, MCP tool call), use the Flow method's own callback parameter — `disconnect(request, async () => {...})` / `callTool(client, tool, args, async () => {...}, timeout)` — rather than asserting only after the fact.

### 9a. Documenting a real Insomnia *app* bug (not a bug in this framework's own code)

This is distinct from the Scope Constraint's exception above — that one is about a broken `flows/`/`pages/` method in *this test framework*, fixed in place. Here the framework code is fine; the real Insomnia application itself behaves incorrectly.

- Write the test asserting the **expected/correct** behavior — never the current buggy one — exactly as if the bug didn't exist. Never invert an assertion just to make it pass against the bug.
- Mark the test with `test.fail(true, "INS-1234")` as the very first statement in the test body, where `"INS-1234"` is the Jira ticket key — don't invent a ticket number; if none exists yet, ask the user whether to file one (filing a real Jira ticket is a visible action outside this repo, not something to do unprompted) or use `test.fail();` with no description for now. This reports the test as an **expected failure** (counted as passed in the run summary, shown as "✘" without blocking CI) for as long as the bug is open. If the underlying app bug ever gets fixed, the test starts unexpectedly *passing*, and Playwright reports that as a failure — the signal to remove `test.fail()` and let the test go green for real.
- Do **not** put the ticket key in the test title — it lives only in the `test.fail()` description.

### 10. Blank-line style: group by flow

Format blank lines in the action-step section by which flow instance is being called, not one-blank-line-per-statement:

- **No blank line** between consecutive statements that call the *same* flow instance — e.g. `environmentFlow.create(...)` immediately followed by `environmentFlow.link(...)`, or a run of `socketIoRequestFlow.create(...)` / `.connect(...)` / `.sendMessage(...)` / `.disconnect(...)`.
- **One blank line** exactly where the next statement switches to a *different* flow instance (`workspaceFlow` → `environmentFlow` → `socketIoRequestFlow`, etc.) — this is what visually marks the domain/setup boundaries in the test body.
- **A plain variable declaration (no flow call) belongs to whichever flow group it's nearest to** — specifically, the group that *consumes* it. It's not its own group and doesn't get a blank line before or after it relative to that group; the blank line goes only between it and the *previous* flow group. E.g. `const names = Array.from({ length: 5 }, () => faker.person.firstName())` that only feeds the next block's `grpcRequestFlow.create(...)`/`.streamMessage(...)` calls sits immediately above them, with the blank line placed before `names`, not after it.
- This composes with §9: inside the trailing assertion block, consecutive `expect(...)` calls also get no blank line between them — one flowing block of assertions, not one per line.

```ts
const collection = await workspaceFlow.create(project, new Collection(name));

const environment = await environmentFlow.create(project, { ... });
await environmentFlow.link(collection, environment);                  // same flow as above — no blank line

const names = Array.from({ length: 5 }, () => faker.person.firstName()); // feeds the group below — no blank line after it
const request = await socketIoRequestFlow.create(collection, { ... });
await socketIoRequestFlow.connect(request);                            // same flow — no blank line
const response = await socketIoRequestFlow.sendMessage(request);       // same flow — no blank line

expect(response.statusCode).toBe(200);
expect(response.events?.length).toBeGreaterThan(0);                    // consecutive expects — no blank line
```

Real example: `tests/document/happy-path.spec.ts`.

### 11. Self-check before returning

- [ ] The TodoWrite plan from step 5 is fully checked off — no follow-up items silently dropped.
- [ ] Existing coverage was checked (step 2) before creating a new file, in priority order — no new spec was added for a test point an existing one already proves, and an existing test was extended in place wherever that was an easy, coherent fold rather than reached past for a new file.
- [ ] No file outside `tests/` was created or modified, unless it was a confirmed bug fix under the Scope Constraint's exception — any *gap* found in `flows/`/`pages/`/`models/` was reported to the user, not patched.
- [ ] If a framework bug was fixed: it was confirmed as broken (not merely unsupported) via a probe, the fix was minimal and targeted at that bug only (no unrelated refactors/new methods), the probe was re-run to confirm the fix, and the bug + fix were called out to the user as their own item.
- [ ] If the test documents a real Insomnia *app* bug (not a framework bug, per §9a): it asserts the expected/correct behavior (never the current buggy one), starts with `test.fail();`, and confirmed via a real run that it reports as an expected failure ("✘" but counted as passed), not a hard failure.
- [ ] `import { expect, test }` comes from the relative path to `misc/fixtures` (not `@playwright/test`) — except Git Sync specs, which import from `misc/git-fixtures` (see `reference.md`).
- [ ] The test function takes only `{ user }` — no `workspaceFlow`/`pageManager`/other per-flow fixture in the parameter list.
- [ ] Every Flow/Page method and every Model field used actually exists in `reference.md` or the real source file — nothing invented.
- [ ] Every direct `pageManager.xxxPage` call was necessary because no Flow method covers that action (per "Prefer Flow methods over direct Page access") — never a Page call standing in for a step a Flow method already does.
- [ ] All names via `faker`; all fixed values via `enums/`.
- [ ] No hand-written `test.step(...)`.
- [ ] No comments anywhere in the spec file.
- [ ] All `expect` calls are grouped at the end of the test, after every action step — no mid-test "check as you go" assertions (except a live-connection-only observation inside a `disconnect`/`callTool` callback, or a `Response.console`/`.events`/`.tests` check verified right after its own response's `send()` because the test captures more than one distinct request/response).
- [ ] If the user's original request didn't spell out what to assert, that was clarified with the user first (per §9) — the assertion block wasn't silently invented, and it isn't narrower than what the feature obviously implies just because the user only named one field.
- [ ] Any assertion on delayed UI state uses `.toPass(...)` or `expect.poll(...)`, not a fixed sleep.
- [ ] Blank lines follow §10: none between same-flow calls, one when switching flows, none between consecutive trailing `expect`s.
- [ ] The `const { ... } = user.flowManager;` (and `const { ... } = user.pageManager;` if present) destructuring sits at the very top of the test body, followed by exactly one blank line before the first action step — never inline with, or run on without a break into, the first `await`/`const` action line.
- [ ] No `const { pageManager } = user;` / `const { flowManager } = user;` (whole-object destructure) anywhere, and no inline `user.pageManager.xxxPage...`/`user.flowManager.xxxFlow...` mid-body — every Page/Flow instance used is destructured by name at the top, from `user.pageManager`/`user.flowManager` directly.
- [ ] File path and name follow §7, including its own directory if it uses a fixture file.
- [ ] No leftover `_probe*.spec.ts` files from step 6.
- [ ] If feasible, actually run it: `npx playwright test <new-file-path>` (by default launches dev-mode against the sibling `../insomnia` source checkout — see reference.md's "App launch" section; set `INSOMNIA_BINARY` or `INSOMNIA_DEV_MODE=false` to target a specific/packaged build instead) — confirm it passes for real, not just that it type-checks.

### 12. Summarize the finished test case for the user

Once the spec is written (or an existing one extended) and step 11's self-check passes, always close out by writing a short plain-language description of the test case back to the user — this is in addition to the code, not a replacement for the self-check. Use exactly these three headings:

1. **Test Case Summary** — one or two sentences: what scenario/feature/behavior this test verifies, in plain language (not code).
2. **Test Procedure** — the ordered list of setup/action steps the test performs, described in plain language (e.g. "Create a project and collection", "Create an environment with variable X linked to the collection", "Send the request"), mirroring the composed Flow calls in order — not a restatement of the TypeScript.
3. **Assertions** — what the trailing `expect` block actually checks, each on its own line in plain language (e.g. "Response status is 200", "Response body echoes the sent header").

If step 2 concluded this was an edit to an existing file rather than a new one, describe the summary/procedure/assertions for the test *as it now stands* (the widened version), not just the delta that was added. If the test documents a real app bug (§9a) with `test.fail()`, say so explicitly in the summary line (e.g. "documents INS-1234 — expected to fail until fixed").

## Reference

See `reference.md` in this same folder for: the domain → fixture/flow/page/model table, every Flow method's exact signature, Model field lists, enum values, and mock-server URLs/ports.
