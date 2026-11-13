---
name: run-insomnia
description: 'Launch the real Insomnia Electron app and drive its UI — click, type, ARIA snapshot, screenshot, read its NeDB store — against the production, dev, staging or mock backend, already signed in. Use for any hands-on work in the Insomnia desktop repo. Reach for it when implementing a feature or fixing a bug there, both to reproduce the problem first and to confirm the change actually works in the running app before calling it done, since unit tests alone do not establish that. Also when asked to run, start, screenshot, or log in to Insomnia.'
---

Insomnia is an Electron app. To verify a change the way a developer would —
open the app, click through it, look at the result — drive it through the
Playwright `_electron` driver in this folder.

The driver is a **long-running process with an HTTP control channel**, so the
app launches once (~20s) and then every interaction is a cheap one-line shell
call. A throwaway Playwright test would relaunch the app on every iteration.

The driver finds the checkout to drive from its **working directory** (walking
up for `packages/insomnia/package.json`) rather than from its own location, so
it runs correctly from either place you might keep it:

```bash
S=.claude/skills/run-insomnia            # this repo — shared with the team, updated by git
S=~/.claude/skills/run-insomnia          # a personal copy, if you prefer one install for every worktree
```

`S` is used throughout this document; paths are otherwise relative to the
worktree root. Override the detected checkout with `INSOMNIA_REPO=<path>`.

Keeping a personal copy as well as the committed one means two skills share a
name — pick one.

## Prerequisites (once per worktree)

```bash
node -v                                  # must match .nvmrc (fnm use "$(cat .nvmrc)")
npm ci                                   # NOT --ignore-scripts: that leaves Electron half-installed
ls node_modules/electron/dist/electron*  # if missing: node node_modules/electron/install.js
```

## Start the three background processes

```bash
cd <the worktree you want to drive>
npm run watch:app                     # builds the main/preload bundles ONCE, then runs the Vite dev server forever
node $S/driver.mjs                    # Control channel on 127.0.0.1:9800; prints the repo it resolved
npm run serve -w insomnia-smoke-test  # Echo server on :4010 — only needed for the `mock` profile
```

Check the driver's `repo=` line is the worktree you meant. `status` and `whoami`
repeat it.

To drive two worktrees at once, give the second one its own port **and** its own
data dir — `~/.insomnia-driver/<profile>` is shared, and Electron's
single-instance lock is keyed on it:

```bash
DRIVER_PORT=9801 node $S/driver.mjs
DRIVER_PORT=9801 node $S/drive.mjs launch '{"dataPath":"/tmp/insomnia-wt2"}'
```

Wait for `VITE ... ready in` before launching (and `Listening at http` too, if
you are going to use `mock`).

Despite its name `watch:app` only watches the *renderer*. It is
`build:electron-entrypoints && start:dev-server`: esbuild compiles
`src/entry.{main,preload,hidden-window,plugin-window}*.ts` once and exits, then
`vite dev` stays up and writes `packages/insomnia/.vite-port`. The main process
reads that file in `window-utils.ts` and `loadURL`s the dev server, which is why
the port file is the launch handshake — and why `launch` refuses to start
without it.

Don't use `npm run dev` / `dev:autoRestart` here: both spawn their own Electron,
which would race the one the driver owns.

## Drive it

```bash
D=$S/drive.mjs
node $D launch                     # opens the app, signed in as the smoke-test account, fresh data dir
node $D snapshot                   # ARIA tree as YAML — read this to decide what to click
node $D click '{"target":{"role":"button","name":"Send"}}'
node $D screenshot '{"name":"after-send"}'   # -> %TEMP%/insomnia-shots/after-send.png, then Read it
```

`snapshot` before `screenshot`. The ARIA tree names every clickable element and
costs a fraction of the tokens an image does; use a screenshot when the question
is visual (layout, colour, overlap) or when a snapshot doesn't explain what you see.

### Ops

| op | args | what it does |
|---|---|---|
| `launch` | `profile?`, `dataPath?`, `fresh?`, `fixtureDb?`, `settings?`, `env?`, `display?` | start the app |
| `moveWindow` | `display` | move the app window to another monitor, see below |
| `profiles` `whoami` | | list backends / show account + backend in use |
| `login` `submitCode` `waitForSession` | `provider?` / `code` | real browser login, see below |
| `reload` | | reload the renderer only — picks up `src/ui/**` edits in ~3s |
| `relaunch` | same as launch | full restart, same data dir — for `src/main/**` edits and cold-start checks (rebuild first, see below) |
| `quit` / `status` | | close / inspect |
| `snapshot` | `target?` | ARIA tree (YAML) |
| `screenshot` | `name?`, `target?`, `fullPage?` | PNG path to `Read` |
| `click` `hover` `fill` `type` `press` | `target`, `value`/`text`/`key` | interact |
| `text` `count` `wait` | `target`, `state?` | assert |
| `eval` `mainEval` | `expr` | renderer / main-process JS (`mainEval` takes a *function expression*) |
| `netlog` `throttle` | `action`/`pattern` / `latency` | watch and slow Insomnia's own HTTP, see below |
| `db` | `type`, `where?`, `fields?` | read the live NeDB store |
| `logs` `errors` | `type?`, `limit?` | renderer console + uncaught errors |
| `importFixture` | `file` | import a `packages/insomnia-smoke-test/fixtures` file via the real import UI |
| `setClipboard` | `text` | write to the OS clipboard |
| `sleep` | `ms` | |
| `demo` | `text`, `step?`, `of?`, `target?`, `position?` | caption + highlight in the app window, for a human watching |
| `exec` | `file` or `code` | **escape hatch — arbitrary Playwright code, see below** |
| `note` `feedback` | `text` / `limit?`, `kind?` | report / read driver friction, see below |

### Which monitor the app opens on

On launch the window is moved to the **rightmost** display and maximised there.
The person watching is usually reading this conversation in an editor, and an
Insomnia window landing on top of it buries the very text explaining what the
app is doing.

```bash
node $D launch '{"display":"left"}'     # right (default) | left | primary | <index> | none
node $D moveWindow '{"display":"primary"}'
```

Change the default for a session with `DRIVER_DISPLAY=primary node $S/driver.mjs`,
and pass `"none"` to leave the window wherever Electron put it.

With one monitor this just maximises — there is nowhere else to go, so use
`"none"` if that is in the way.

### Profiles — which backend the app talks to

`launch` takes a `profile`. **`prod` is the default** — this app is developed
against the real backend day to day, and every real profile stays logged in, so
that is the cheap path. Override the default for a session with
`DRIVER_PROFILE=dev node driver.mjs`.

| profile | backend | data dir |
|---|---|---|
| `prod` *(default)* | `api.insomnia.rest` / `app.insomnia.rest`, real login | `~/.insomnia-driver/prod`, **kept** |
| `dev`, `staging`, ... | whatever `profiles.json` defines, real login | `~/.insomnia-driver/<name>`, **kept** |
| `mock` | echo server on :4010, injected fake session | temp, **wiped every launch** |

Reach for `mock` when you are offline, reproducing a smoke-test scenario, or
deliberately want a blank slate that can't touch real data.

Add `dev`, `staging` or a self-hosted instance in `profiles.json` next to
`driver.mjs` — copy `profiles.example.json` to start. `profiles.json` is
gitignored: this repo is public, so internal hostnames stay out of it; ask a
teammate for the real values. Profiles and their logins live under
`~/.insomnia-driver/`, so they are **shared by every worktree and survive a
reinstall**: sign in once, use it everywhere. Mirror the
env vars from however the team runs `npm run dev` against that stack; anything
left out falls back to the **production** default in `common/constants.ts`, so
omitting e.g. `KONNECT_API_URL` points that one service at prod:

```json
{ "dev": { "description": "internal dev stack",
           "env": { "INSOMNIA_API_URL": "https://api.dev.example",
                    "INSOMNIA_APP_WEBSITE_URL": "https://app.dev.example",
                    "KONNECT_API_URL": "https://api.dev.example" } } }
```

`prod` works by setting **nothing**: `common/constants.ts` already defaults to
production, so an empty `env` is the production config. The driver first strips
every backend-steering var (`MANAGED_ENV_KEYS`) out of the inherited environment,
so a stray `INSOMNIA_API_URL` in your shell can't silently redirect a run.

Switching profiles needs `quit` then `launch` — one app per driver. A data dir
records its owning profile in `.driver-profile` and `launch` refuses a mismatch:
starting `mock` against a real profile's dir would write the fake
`INSOMNIA_SESSION` over the real login. `relaunch` carries the profile across for
the same reason.

### Real login, and reusing it

`entry.main.ts` does `app.setPath('userData', INSOMNIA_DATA_PATH)`, so the NeDB
store *and* the Chromium localStorage live in the profile's data dir. A
non-ephemeral profile therefore **keeps its login across relaunches and driver
restarts** — log in once per profile, not once per run.

```bash
node $D launch '{"profile":"prod"}'
node $D whoami                       # loggedIn: true? then you are done
node $D login                        # -> { available: [Google, GitHub, Email, SSO], url }
node $D login '{"provider":"GitHub"}'  # clicks it; the app opens your browser
# ...user signs in...
node $D waitForSession               # polls the data dir, up to 5 min
```

`login` clicks the app's own provider button rather than opening the URL itself:
that is what routes the app to `/auth/login-tip` → `/auth/authorize`, and it
exercises the same code path a user would. The driver parks on the
paste-token screen so the fallback is ready.

If the browser never returns to the app, copy the token the site shows:

```bash
node $D submitCode '{"code":"<token>"}'
```

**Do not `reload`, `relaunch` or restart the driver between `login` and the token
exchange.** `auth-session-provider.client.ts` calls `sealedBox.keyPair()` at
module scope and overwrites `localStorage` on *every* page load, so a reload
invalidates the token the website just issued. Once the session exists it is in
NeDB and survives everything.

The deep-link callback is `insomniadev://` in dev builds (`insomnia://` only in
packaged ones), so it will not collide with an installed Insomnia. It is
registered from `process.argv`, which is why the driver launches Electron with
`.` rather than the entry file — a relative entry path would register a command
line that only resolves from one cwd.

### exec — the whole Playwright API

The ops above are shorthand for the common cases. `exec` is the escape hatch:
anything in the Playwright API, any number of steps, in **one** round trip.

Preferred form — write a `.ts` file and pass its path. No shell or JSON escaping,
and the driver's TS loader lets it import the smoke suite's Page Objects:

```ts
// scripts/my-flow.ts — must `export default` an async function
import { InsomniaApp } from '../../../../packages/insomnia-smoke-test/playwright/pages';

export default async ({ page, app, expect, log, ops }) => {
  const insomnia = new InsomniaApp(page, app);
  await insomnia.projectPage.importFixture('smoke-test-collection.yaml');
  await insomnia.navigationSidebar.clickRequestOrFolder('send JSON request');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('response-status-tag')).toContainText('200 OK');
  log('sent ok');
  return await ops.db({ type: 'Response', fields: ['statusCode', 'url'] });
};
```

```bash
node $D exec scripts/my-flow.ts          # resolved against the worktree, then the skill dir
```

`exec` resolves a relative path against the worktree first, then against the
skill directory — so `exec scripts/example-flow.ts` reaches the bundled examples
and `exec tmp/my-flow.ts` reaches one you wrote in the checkout.

Import repo sources with the **`@repo/`** prefix rather than a relative path;
the skill lives outside the checkout, so `../../..` would not reach it:

```ts
import { InsomniaApp } from '@repo/packages/insomnia-smoke-test/playwright/pages';
```

See [scripts/example-flow.ts](scripts/example-flow.ts) and
[scripts/goto-login.ts](scripts/goto-login.ts) — both run as-is.

One-liners can go inline instead, as the body of an async function with the
context pre-destructured:

```bash
node $D exec '{"code":"return await page.getByRole(\"tab\").allInnerTexts()"}'
```

`mainEval` runs in the main process and takes a **function expression**, called
with the electron module as its argument. There is no `require` in there:

```bash
node $D mainEval '{"expr":"({ app }) => app.getPath(\"userData\")"}'
node $D mainEval '{"expr":"async ({ session }) => await session.defaultSession.getCacheSize()"}'
```

Context: `page`, `app`, `expect` (auto-retrying assertions from `@playwright/test`),
`ops` (every op in the table above), `locate` (the JSON target resolver), `log`
(collects values into the response), `dataPath`, `REPO`, `APP_CWD`, `FIXTURES`.

`log()` output and the return value both come back; a thrown error returns the
message, the stack, **and** the logs collected before it threw, so a failing
script still shows how far it got. The return value must be JSON-serialisable —
a Locator comes back as its string form, so return data, not handles.

Reach for `exec` whenever a flow is more than ~3 steps, or needs a Playwright
feature the ops don't cover. **Don't extend `driver.mjs` for one-off needs** —
that costs a driver restart, which kills the running app.

### Watching and slowing Insomnia's own network

**Renderer-side interception does not work on this app.** Insomnia takes over
the `http:` and `https:` schemes itself in
`packages/insomnia/src/main/api.protocol.ts:139,160` and re-issues every request
from the main process via `net.fetch`. The request the page sees is a stub that
never reaches the wire. So:

- `page.on('request')` / `page.route()` record traffic only intermittently —
  they catch the stub when timing happens to favour them, and miss it otherwise.
  A run that records 5 calls and a run that records 0 can be the same flow.
- `route.continue()` delays, `session.enableNetworkEmulation()` and CDP
  `Network.emulateNetworkConditions` all measure as **no-ops**. All three were
  tried; re-run [scripts/probe-throttle.ts](scripts/probe-throttle.ts) if you
  want to see it for yourself.

`session.defaultSession.webRequest` in the main process does see it, and that is
what these two ops are built on:

```bash
node $D netlog '{"action":"start","pattern":"konghq"}'   # pattern filters while recording
# ...reproduce the flow...
node $D netlog '{"action":"read"}'                       # url, method, status, ms
node $D netlog '{"action":"stop"}'

node $D throttle '{"latency":1500}'                      # make a race reproducible
node $D throttle '{"off":true}'
```

Two things to expect:

- **Every API call shows up twice** — once as the renderer's original
  (`type: "xhr"`) and once as main's re-issue (`type: "other"`). That is the
  interception, not a retry.
- **Latency is applied per event, so end-to-end delay is roughly double** what
  you ask for. Measured: 215ms baseline -> ~3200ms at `latency: 1500`. Dial it
  in against a `netlog` reading instead of trusting the number.

Filter with `pattern` at `start`, not at `read`: Sentry's `sentry-ipc://`
protocol alone emits hundreds of entries a minute and will evict real traffic
from the buffer. Non-http schemes are dropped unless you pass `all: true`.

Neither op sees the requests the **user** sends from the app — those go through
node-libcurl, outside Chromium. Use the echo server's log or `db` with
`{"type":"Response"}` for those.

### Targets

`target` is a JSON description, resolved to a Playwright locator:

```json
{"role":"button","name":"Send","exact":true}
{"testid":"response-status-tag"}
{"css":"[data-testid=\"response-pane\"] [data-testid=\"CodeEditor\"]:visible"}
{"role":"button","name":"Send","within":{"testid":"request-pane"}}
```

Keys: `css` | `role`+`name` | `testid` | `label` | `placeholder` | `title` | `text`,
plus `within` (scope), `hasText`, `exact`, `nth`/`first`/`last`. A bare string is CSS.

Insomnia is built on React Aria, so `role`+`name` works almost everywhere, and the
codebase is well covered by `data-testid`. Copy targeting patterns from
`packages/insomnia-smoke-test/tests/smoke/*.test.ts` — the Page Objects in
`packages/insomnia-smoke-test/playwright/pages/` are the maintained reference for
multi-step flows (import, git sync, preferences).

## Report anything that got in your way

This driver is maintained in a separate worktree and session from the one you
are probably in. Per-project memory does not cross worktrees, so the one channel
that reaches its maintainer is the friction log at
`~/.insomnia-driver/feedback.jsonl`.

**Every failed op is appended there automatically** — you don't have to do
anything for those. What the log cannot see is intent, so add it yourself the
moment the driver costs you time:

```bash
node $D note '{"text":"wanted to drag a request between folders; no op for it and locator.dragTo timed out on the tree"}'
```

Worth a `note`:

- an op you expected to exist and didn't
- a selector that took several tries, especially if the ARIA name was misleading
- a gotcha that cost you a debugging cycle and is not in the Gotchas below
- anything you worked around with `exec` that deserves promoting to an op

Not worth a `note`: one-off app bugs you are there to fix. This log is about
the *tooling*, not the product.

Pass `{"quiet":true}` on an op you expect to fail (probing whether an element
exists) so it stays out of the log.

## The loop

1. `snapshot` the current screen, reproduce the bug, `screenshot` the evidence.
2. **Stop and replay the repro for the user** with the `demo-insomnia` skill,
   before writing any fix. You just drove the UI faster than anyone can read;
   the user saw windows flash and learned nothing. This is not optional and
   they should not have to ask for it.
3. Edit the code.
4. `src/ui/**` -> `reload`. `src/main/**` -> `npm run build:electron-entrypoints -w insomnia`, then `relaunch`. Never restart the driver.
5. `snapshot` / `text` / `db` to confirm the new behaviour.
6. **Replay the same script for the user** (`demo-insomnia` again) — identical
   steps, different ending. That is what proves the fix, not a passing test.
   Same for a finished feature: walk them through using it.
7. Regression gate: `npm run test:smoke:dev -- <title-substring>`. It reuses the
   already-running Vite and echo servers, so it costs no extra setup.
8. `npm run lint && npm run type-check && npm test`.
9. `note` anything about the driver that slowed you down (see above).

## Gotchas

- **Editing `driver.mjs` needs a driver restart, which kills the app.** This is
  why `exec` exists — new capability should go in an exec script, not a new op.
- **Edits to this skill affect every worktree.** There is one copy. Prefer an
  exec script over changing the driver.
- **Exec scripts are cache-busted, the modules they import are not.** Editing
  `my-flow.ts` and re-running picks the edit up; editing a Page Object it imports
  needs a driver restart.
- **`src/main/**` edits are not picked up by anything automatically.** esbuild in
  `watch:app` is a one-shot build, not a watcher. Re-run
  `npm run build:electron-entrypoints -w insomnia` and then `relaunch`. Only the
  renderer (`src/ui/**`) is live, because Vite serves it.
- **`strict mode violation` is the normal failure.** The error lists every match
  with its accessible name — add `exact`, `within`, or `nth` and retry. Don't
  reach for `force`.
- **CodeMirror fields ignore `fill`.** URL bars, body editors and the import
  dialog are CodeMirror; use `type` (which clicks, then sends real keystrokes).
- **`launch` wipes its data dir by default.** Pass `dataPath` to keep state across
  driver restarts, or `fixtureDb` to start from a seeded store.
- **The default profile touches real cloud data.** `prod` means UI actions create,
  modify and delete things in a real account. Creating scratch collections is
  routine; confirm deletions and edits to pre-existing data with the user first.
  Only `mock` is sealed off — every Insomnia API env var points at
  `localhost:4010` there, so nothing leaves the machine.
- **`fresh: true` on a real profile deletes its login.** Wiping is automatic only
  for `mock`; on `prod` it has to be asked for, and it costs you a re-login.
- **`launch` fails with "Target page ... has been closed" -> a stray Electron holds
  the single-instance lock.** Deep linking (needed for the login callback) turns on
  `requestSingleInstanceLock()`, so one leftover process blocks every new launch.
  `taskkill /f /im electron.exe` (Windows) / `pkill -f electron` and retry.
- **Closing the app window by hand leaves the driver's handles stale.** `launch`
  detects it and restarts, but `status` will show `windows: []` until then.
- **NeDB appends, so a clobbered doc is recoverable.** Every write is a new line in
  `insomnia.<Type>.db` and the last line for an `_id` wins; truncating the file back
  to the good line restores the earlier state.
