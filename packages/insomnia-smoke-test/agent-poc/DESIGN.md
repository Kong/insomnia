# AI-agent E2E test generation for Insomnia (Electron) — design & flow

> How the planner → generator → healer agents explore the live Insomnia app,
> generate Playwright E2E tests, and self-heal them — and why it's built this way.
> For the quickstart, see [`README.md`](./README.md).

## Goal

Bring the [Playwright Test Agents](https://playwright.dev/docs/test-agents)
workflow to Insomnia's Electron app:

1. **Explore** the live app through real interaction and produce a test plan.
2. **Generate** runnable Playwright tests from that plan.
3. **Heal** failing tests by reproducing the failure live and fixing it.

The official agents are browser-only (their MCP drives a browser via
`page.goto(url)`). Insomnia is Electron — but its **renderer is a Chromium
target**, so the same official `@playwright/mcp` attaches to it over CDP and
drives it exactly like a browser. That is the key enabler of this design.

## Architecture

```
            ┌──────────────────────────────────────────────┐
            │  start-cdp.sh  (one command)                  │
            │   echo :4010 · vite :3334 · Electron :9222    │
            └───────────────┬──────────────────────────────┘
                            │ explore.ts --keep-open --debug-port 9222
                            ▼
        renderer CDP endpoint  http://localhost:9222
                            ▲
                            │ @playwright/mcp --cdp-endpoint   (.mcp.json: "insomnia-cdp")
                            │ mcp__insomnia-cdp__browser_*
        ┌───────────────────┴───────────────────────────────┐
        │  Planner  →  Generator  →  Healer  (subagents)     │
        │  act → observe → decide  (closed loop)             │
        └────────────────────────────────────────────────────┘
                            │ generates / fixes
                            ▼
        packages/insomnia-smoke-test/tests/smoke/*.test.ts   (the source of truth, runs in CI)
```

- **`explore.ts`** boots the real app with the **same launch wiring as the test
  fixture** (`../playwright/test.ts` + `paths.ts`: same `_electron.launch`, env,
  injected session) and exposes the renderer over CDP. Parity is the point —
  whatever an agent discovers maps 1:1 onto committed tests. It can also `--seed`
  a known state and dump an ARIA snapshot.
- **`@playwright/mcp` over CDP** gives the agents `browser_snapshot`,
  `browser_type`, `browser_click`, `browser_evaluate`, `browser_network_requests`,
  `browser_tabs`, … against the live renderer — the closed interaction loop.
- **Three subagents** (`.claude/agents/insomnia-e2e-{planner,generator,healer}.md`)
  are auto-matched by Claude Code on description.

## The workflow

**Stage-gated:** each stage stops for human review — the planner does not auto-invoke
the generator, nor the generator the healer. You review (and adjust) each stage's
output, then explicitly ask for the next. (The agent `description`s are written to be
user-invoked, not proactive, so Claude Code won't chain them on its own.)

### 1. Planner — explore & plan (closed loop)
Drives the live renderer one step at a time: take an action, read the snapshot it
returns, decide the next action **from what it actually sees** (so it can follow
unforeseen paths, react to dialogs/errors, explore in depth). Records **stable**
locators (role+name / test-id / regex — never ephemeral snapshot refs) and writes
a human-readable plan to `specs/<feature>.md`.

### 2. Generator — validate-then-write
For every step and every assertion: resolves the locator live, **proves it
matches exactly one element** (catching strict-mode collisions), performs the
action, and confirms the expected change — *then* writes the line. Reuses/extends
**page objects** rather than inlining selectors, and validates the result with
`npm run test:smoke:dev` until green.

### 3. Healer — reproduce live & fix
Reads the failure evidence (`traces/<test>/error-context.md`, trace.zip), then
reproduces the failure on the live renderer and inspects it via `browser_snapshot`
/ `browser_evaluate` to find the real locator/flow. Patches the test or page
object and re-runs until green (or marks `test.fixme()` if the app is genuinely
broken). No human-driven Inspector is involved.

## Key design decisions

- **Closed loop over batch scripts.** Exploration and healing are fundamentally
  about *reacting to what you observe*; a pre-planned, one-shot script can't.
  Driving the renderer live (via CDP) is what makes goals 1 and 3 work.
- **Launch parity with the fixture.** `explore.ts` reuses the fixture's exact
  env/session, and is kept as linted repo code, so discoveries can't drift from
  what CI runs.
- **Page-object reuse.** Generated tests extend the existing POM
  (`playwright/pages/...`) for stability and to match repo conventions.
- **Stable locators only.** `getByRole`(+`exact`)/`getByTestId`/regex — never the
  ephemeral `[ref=…]` from a snapshot. (`getByRole` name is a *substring* match,
  so collisions like `'Create request'` vs `'Create request collection'` need
  `exact: true`.)
- **Seed for starting state.** `--seed <fixture.yaml>` imports a maintained YAML
  fixture before exploration (the "seed test" analog), so deep states are
  explorable and seeded state matches what committed tests produce.

## What's validated

The full pipeline was dogfooded end-to-end on **FirstRequestCreation**: planner
explored it live → generator added `ProjectPage.createFirstRequestByUrl()` and
wrote `tests/smoke/first-request-creation.test.ts` (green) → a locator was broken
and the healer fixed it via live inspection (green). The real `@playwright/mcp`
binary was confirmed to both read and write the Electron renderer over CDP.

## Boundaries & roadmap

- **CDP reaches the renderer only.** Main process / IPC / window lifecycle stay
  with `explore.ts` (`_electron`); secondary renderer windows (e.g. the plugin
  window) are reachable via `browser_tabs`.
- **`.mcp.json` is committed & version-pinned** (`@playwright/mcp@0.0.75`) so the
  whole team gets the workflow and the tool schema can't drift. It's inert until
  `start-cdp.sh` exposes `:9222`. The `mcp__insomnia-cdp__*` tools load at Claude
  Code startup, so a session that just created `.mcp.json` must restart before the
  subagents can call them.
- **Roadmap:** auto-recorded codegen (vs validate-then-handwrite); an
  `_electron`-backed MCP fallback if a specific flow proves flaky over CDP.

---

**Note:** `explore.ts` and `start-cdp.sh` are exploration/debug aids and never run
in CI. The committed Playwright suite is the single source of truth — anything an
agent produces only counts once it passes `npm run test:smoke:dev`.
