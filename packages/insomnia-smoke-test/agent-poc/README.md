# AI-agent E2E workflow (Electron) — quickstart

Brings the **Playwright Test Agents** workflow (planner → generator → healer) to
Insomnia's Electron app. The agents drive the **live renderer** in a closed loop
via the official `@playwright/mcp` attached over CDP. For the design & rationale,
see [`DESIGN.md`](./DESIGN.md).

## Files

```
agent-poc/
  README.md        this quickstart
  DESIGN.md        design & flow
  start-cdp.sh     one-command stack bring-up (echo + vite + app w/ CDP); --stop, --seed
  explore.ts       the launch substrate (_electron, same wiring as the test fixture)
  specs/           example planner output (Markdown test plans)

(repo root)
  .mcp.json                          "insomnia-cdp" → @playwright/mcp --cdp-endpoint :9222
  .claude/agents/insomnia-e2e-*.md   the planner / generator / healer subagents
```

## Prerequisites

Repo's Node (`.nvmrc`) and deps installed (`npm ci`). `start-cdp.sh` brings up
everything the dev bundle needs (echo server, Vite dev server, dev main bundle)
and reuses anything already running.

## Run it

```bash
# boot the stack + expose the renderer over CDP (add --seed simple.yaml for a known state)
bash packages/insomnia-smoke-test/agent-poc/start-cdp.sh        # wait for READY ✅
# then restart Claude Code once, so it loads .mcp.json (the insomnia-cdp MCP server)

# …run the staged workflow below…

# tear down when finished
bash packages/insomnia-smoke-test/agent-poc/start-cdp.sh --stop
```

## Workflow (stage-gated — you drive each step)

The three agents do **not** chain automatically. Each one stops at the end of its
stage so you can review (and adjust) its output; you then explicitly ask for the
next stage. Drive it with prompts like:

| Step | Suggested prompt | What it does → what you review |
|------|------------------|--------------------------------|
| **1. Plan** | `Plan E2E tests for the <feature> component in Insomnia` | Planner explores the live app, writes `agent-poc/specs/<feature>.md`, then stops. → Review/edit the scenarios and their P0/P1/P2 tags. |
| **2. Generate** | `Generate the test for scenario <n> in agent-poc/specs/<feature>.md` | Generator validates each locator/assertion live, writes `tests/smoke/<feature>.test.ts`, runs it green, then stops. → Review the test + any page-object changes. |
| **3. Heal** (only if it fails) | `The "<test title>" smoke test is failing — debug and fix it` | Healer reads the trace, reproduces live, patches the test/page object, re-runs green, then stops. → Review the fix. |

Tips:
- Name the feature/component so the planner knows where to look.
- Generate **one (or a few) scenarios at a time**, not the whole plan — easier to review.
- Each agent is matched by Claude Code from your request and drives the renderer via
  `mcp__insomnia-cdp__browser_*`, validating with `npm run test:smoke:dev`. It will
  **not** advance to the next stage on its own — that's the gate.

## Standalone substrate use

```bash
npm run explore -w insomnia-smoke-test                                     # boot + ARIA snapshot + exit
npm run explore -w insomnia-smoke-test -- --keep-open --debug-port 9222    # what start-cdp.sh runs
npm run explore -w insomnia-smoke-test -- --seed simple.yaml               # seed a known state
```

## Boundaries

- `explore.ts` / `start-cdp.sh` are exploration aids — **never run in CI**.
- The committed Playwright suite is the **single source of truth**: anything the
  agents produce only counts once it passes `npm run test:smoke:dev`.
- CDP reaches the **renderer**; main process / IPC stay with `explore.ts`
  (`_electron`), secondary renderer windows via the MCP `browser_tabs` tool.
