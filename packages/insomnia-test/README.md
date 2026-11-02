# insomnia-test

Playwright E2E tests for the Insomnia desktop app (Electron). Tests are written against a layered page-object model so specs read as user scenarios rather than selectors.

## Layout

```
components/   Reusable UI widgets (dropdown, modal, tree, code editor, ...)
pages/        Page objects — locators + low-level interactions for one screen/dialog
flows/        Multi-step user journeys built on pages (create request, send, git commit, ...)
models/       Plain data classes describing what to create (Project, Collection, HttpRequest, ...)
enums/        Shared enums (HttpMethod, ContentType, AuthType, ...)
misc/         Fixtures, Electron launcher, mock servers, coverage helpers, constants
tests/        Specs, grouped by feature (http-request, git-sync, mock-server, upgrade, ...)
```

How the layers fit together:

- **Spec** → gets `user` from the fixture in `misc/fixtures.ts`, then uses `user.flowManager` (e.g. `workspaceFlow`, `httpRequestFlow`).
- **Flow** → orchestrates pages; accessed through `FlowManager` (`flows/flow-manager.ts`).
- **Page / Component** → Playwright locators and actions, accessed through `PageManager` (`pages/page-manager.ts`).
- **Model** → input data for flows; use `@faker-js/faker` for unique names.

Imports use the `@package/...` alias (e.g. `@package/misc/fixtures`, `@package/enums/http-method`).

## Example

```ts
import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("create a collection", async ({ user }) => {
  const { workspaceFlow } = user.flowManager;
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));
});
```

See `tests/http-request/happy-path.spec.ts` for a fuller one.

## Running

Run from `packages/insomnia-test`:

```bash
npx playwright test                       # everything
npx playwright test tests/http-request    # one directory
npx playwright test -g "Verify Create"    # filter by title
npx playwright test --ui                  # interactive UI
PWDEBUG=1 npx playwright test <file>      # step-through debugger
```

`playwright.config.ts` automatically starts everything the tests depend on (reusing already-running instances locally):

| Server | Port(s) | Script |
| --- | --- | --- |
| Mock Insomnia API | 4010 | `npm run mock-api` |
| Event stream (SSE) | 4050 | `npm run event-stream-server` |
| HTTP echo | 4060–4063 | `npm run echo-server` |
| Socket.IO | 3000 / 3001 | `npm run socket-server` |
| WebSocket echo | 4040 / 4041 | `npm run ws-echo-server` |
| MCP | 4020–4022 | `npm run mcp-server` |
| gRPC | 9000–9002 | `npm run grpc-server` |
| Git HTTP | 4070 | `npm run git-server` |
| OAuth2 | 4080 | `npm run oauth2-server` |
| Mock bin | 4090 | `npm run mock-bin-server` |

TLS/mTLS certificates for these servers are generated on first run (`misc/certs.ts`, output in `misc/fixtures/generated/`, git-ignored). Endpoint constants live in `misc/constants.ts`.

### Which Insomnia build is tested

| Mode | When | What launches |
| --- | --- | --- |
| Dev mode (default) | `INSOMNIA_BINARY` unset | Electron against the sibling `packages/insomnia` source; the Vite dev server (`:3334`) is started for you |
| Packaged build | `INSOMNIA_BINARY=/path/to/insomnia` (CI always does this) | That binary |
| Installed app | `INSOMNIA_DEV_MODE=false` | The locally installed `/Applications/Insomnia.app` |

### Environment variables

| Variable | Purpose |
| --- | --- |
| `INSOMNIA_BINARY` | Path to the Insomnia binary under test (disables dev mode) |
| `INSOMNIA_DEV_MODE` | `false`/`0` to skip dev mode without specifying a binary |
| `INSOMNIA_VERSIONS_DIR` | Cache dir for old-version builds used by upgrade tests (default: `$TMPDIR/insomnia-test-versions`) |
| `COVERAGE=true` | Collect V8 coverage (output in `coverage/`) |
| `CI` | Enables `forbidOnly` and 2 retries |
| `*_PORT` | Override mock server ports (e.g. `GRPC_PORT`, `MCP_PORT`, `WS_PORT`, `SOCKET_PORT`) |

## Constraints

- **Single worker only.** The suite relies on module-level state and shared mock servers; `--workers` other than `1` throws.
- Default test timeout is 90s, action timeout 30s.
- Each test gets a fresh Electron instance and isolated data path (see the `dataPath` / `insomnia` / `user` fixtures).
- Feature flags read by the app at startup (e.g. Git sync) must be toggled in `test.beforeAll()` — see `setGitSyncFeatureFlag` in `misc/fixtures.ts` — and reset in `afterAll`.

## Artifacts

Written on failure and git-ignored:

- `test-results/` — traces, screenshots, videos (`npx playwright show-trace <trace.zip>`)
- `playwright-report/` — HTML report (`npx playwright show-report`)
- `blob-report/` — sharded CI report parts

## Validation

```bash
npm run lint -w insomnia-test
npm run type-check -w insomnia-test
```

## Writing new tests

Prefer extending the existing layers over putting selectors in specs: add locators to a page/component, journeys to a flow, and input shapes to a model. This repo also has a `write-insomnia-test` Claude Code skill that turns a plain-language scenario into a spec using these layers.

## CI
 
`.github/workflows/insomnia-test.yml` (sharded, builds a Linux binary and runs under `xvfb`).
