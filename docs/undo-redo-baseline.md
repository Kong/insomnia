# Undo/Redo Baseline

Catalog of the current undo/redo behaviour across Insomnia's text-input surfaces, established
before attempting any improvement. Findings below are split into **confirmed by code**,
**confirmed at runtime** (Playwright probe against the dev build), and **open questions**.

## TL;DR

- There are **three input technologies**, each with different undo semantics.
- CodeMirror editors have built-in undo history; plain inputs rely on native browser/OS undo.
- The dominant defect is that **undo history is destroyed on component remount**, and the
  single-line editor (`OneLineEditor`) has no mechanism to restore it (the multi-line
  `CodeEditor` does, via a module-level cache — but only when its cache key is stable).
- A native Electron Edit menu binds `Cmd/Ctrl+Z` to the OS-level undo, which competes with
  CodeMirror's internal history.

## The three input technologies

### A. Multi-line CodeMirror — `CodeEditor`

[`code-editor.tsx`](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx)

| Aspect               | Behaviour                                                                                                                                                                                       | Ref                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Undo engine          | CodeMirror built-in history                                                                                                                                                                     | —                                                                                                                                                                              |
| Init                 | `initEditor` runs once via `useMount`; `defaultValue` applied on mount only → **uncontrolled**                                                                                                  | [:560](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L560)                                                                                         |
| Seed guard           | `clearHistory()` after first `setValue` so the seed isn't undoable                                                                                                                              | [:488](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L488)                                                                                         |
| External writes      | `maybePrettifyAndSetValue` no-ops when value is unchanged                                                                                                                                       | [:296](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L296)                                                                                         |
| **Remount survival** | History is persisted to module-global `editorStates[uniquenessKey]` (`getHistory()`) and restored (`setHistory()`) on re-init — **but only if `uniquenessKey` is unchanged across the remount** | [:324](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L324), [:503](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L503) |
| Persist to model     | debounced `onChange`, `DEBOUNCE_MILLIS = 100`                                                                                                                                                   | [:598](../packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx#L598)                                                                                         |

Consumers (~21): raw body, GraphQL query/variables, environment JSON editor, request
headers/params editors, request-script, markdown, mock response, code-prompt modal, etc.

### B. Single-line CodeMirror — `OneLineEditor`

[`one-line-editor.tsx`](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx)

| Aspect               | Behaviour                                                                         | Ref                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Undo engine          | CodeMirror built-in history                                                       | —                                                                                                                                                                                      |
| Init                 | `initEditor` once via `useMount`, `defaultValue` on mount only → **uncontrolled** | [:255](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx#L255)                                                                                             |
| Seed guard           | `clearHistory()` after first set                                                  | [:221](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx#L221)                                                                                             |
| **Remount survival** | **None.** No `editorStates` equivalent — history is destroyed on every remount    | —                                                                                                                                                                                      |
| `setValue` handle    | Preserves cursor but `cm.setValue()` **clears CM undo history**                   | [:366](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx#L366)                                                                                             |
| Persist to model     | debounced `onChange` (100ms) **+ flush on blur**                                  | [:295](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx#L295), [:304](../packages/insomnia/src/ui/components/.client/codemirror/one-line-editor.tsx#L304) |

Consumers (~14): URL bar, all key-value rows (name/value/description for headers, query,
form-data, env), auth-input rows, cookies modal, WebSocket/gRPC/Socket.IO URL + panes, MCP url bar.

The "uncontrolled + manual `setValue`" design is deliberate — see the comment at
[`request-pane.tsx:71-75`](../packages/insomnia/src/ui/components/panes/request-pane.tsx#L71):
controlling the editor would make typed input lag behind the model round-trip.

### C. Plain inputs — React Aria `Input`/`TextField`, raw `<input>`/`<textarea>`

Approx counts in `packages/insomnia/src/ui`: ~79 `<Input>`, ~42 `<TextField>`, ~19 `<input>`,
~10 `<textarea>`. These are mostly **controlled** (`value` + `onChange`). Undo relies on the
browser/OS native undo stack. A controlled input that re-renders on every keystroke can reset
that native stack — but this is **not universal** (see runtime results).

## Native Electron Edit menu

[`window-utils.ts:305-342`](../packages/insomnia/src/main/window-utils.ts#L305) defines an Edit menu:

- **Undo** → `role: 'undo'`, accelerator `CmdOrCtrl+Z`
- **Redo** → `role: 'redo'`, accelerator `Shift+CmdOrCtrl+Z`

These map to Electron's native `webContents.undo()/redo()`, which act on the focused native
editable element — **independent of CodeMirror's internal history**. This is why plain inputs
get working undo "for free", and why there are two competing undo stacks in CodeMirror surfaces.

## Remount triggers

The request pane builds a composite key and applies it to the URL bar editor and body editor
([`request-pane.tsx:82`](../packages/insomnia/src/ui/components/panes/request-pane.tsx#L82)):

```ts
const uniqueKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${vcsVersion}::${activeRequestMeta?.activeResponseId}`;
```

Any change to a segment remounts the editor:

- **Sending a request** → `activeResponseId` changes.
- **Editing an environment** → `activeEnvironment.modified` changes.
- **Git/Sync version bump** → `gitVersion` / `vcsVersion` changes.
- **Initial load settling** after creating/opening a request (observed below).

On remount, `OneLineEditor` loses all undo history; `CodeEditor` can only restore it if the
`uniquenessKey` is _unchanged_ — but several of these triggers change the key itself, defeating
the restore.

## Runtime findings (Playwright probe, dev build)

Method: drive the real Electron renderer, type via keyboard, read CodeMirror state directly
(`node.CodeMirror.historySize()`, `getValue()`). Probe was temporary and has been removed.

| Scenario                                                                         | Observation                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| URL bar, stable pane, type then settle                                           | `undoDepth = 1` — history retained                                                               |
| URL bar typed as the **first** mutation after creating a collection, then settle | `undoDepth = 1` immediately → **`0` after revalidation settles** (initial-load remount wiped it) |
| Body editor, stable pane, type then settle                                       | `undoDepth = 1` — history retained                                                               |
| Body editor, then **switch tab away and back** (remount)                         | `undoDepth = 0`, value preserved — **remount wipes history**                                     |
| Body editor, real `Cmd+Z`                                                        | Undid the edit (`{"a":1}` → `{"a"}`)                                                             |
| URL bar, real `Cmd+Z` (single run)                                               | Value **unchanged**; focus retained — Cmd+Z did not undo                                         |
| Sidebar filter (plain controlled input), real `Cmd+Z`                            | Native undo **worked** (`"abc"` → `""`)                                                          |

### What this confirms

1. **Remount is the dominant history-killer.** A stable editor keeps its undo stack across the
   100ms persist/revalidation cycle; a remount destroys it (value is re-seeded from the model,
   history is not).
2. **`OneLineEditor` is the most exposed** because it has no history-restore cache and its
   consumers (URL bar, key-value rows) are keyed on volatile composite keys.
3. **"All inputs have undo disabled" is not universally true** — at least one plain controlled
   input (sidebar filter) has working native undo.

### Resolved: why the URL bar lost undo / focus

Follow-up probing (real keyboard + `MutationObserver`) showed the URL bar's `OneLineEditor`
**remounts ~once shortly after the first edit**: the first `patchRequest` triggers a loader
revalidation, which changes a volatile segment of the editor's React `key` (`uniqueKey` =
`activeEnvironment?.modified::requestId::gitVersion::vcsVersion::activeResponseId`). The remount
**blurs the editor and drops its undo history**. So a `Cmd+Z` right after typing finds an
already-blurred, empty-history editor — exactly the "re-render + loss of focus" symptom.
The earlier "history non-empty when stable" reading was just a timing window before that remount
landed. Confirmed: a stable editor keeps focus and undoes correctly; the remount is the disease.

## Improvement opportunities (ranked, least disruptive first)

1. **DONE.** Give `OneLineEditor` history persistence across remounts via a shared
   `editor-state-cache` (also used by `CodeEditor`), keyed by a stable `uniquenessKey`.
2. **DONE.** Narrow the URL bar editor's remount key to `requestId::environmentId::environment.modified`
   so it refreshes on request/environment change but not on sends or local edits (the focus-loss
   paths); external value changes resync in place via OneLineEditor's `defaultValue` effect.
3. **DONE.** `setValue` is non-destructive — it replaces the value via `replaceRange` (history
   preserved, undoable) and no-ops when unchanged.
4. **Reconcile the two undo stacks** (native menu vs. CodeMirror). Out of scope for low-hanging
   fruit; track separately.
5. **Plain controlled inputs (Category C).** Largest surface, lowest per-item value; defer
   unless a specific input is reported.

## Suggested characterization tests (pin current behaviour before changing it)

- **E2E (Playwright)**: type in URL bar → assert undo depth retained when stable; Send → assert
  remount occurs and history is lost (documents the bug); body editor → assert tab-switch remount
  loses history. These lock the baseline so a fix's improvement is measurable.
- **Unit (Vitest)**: `shouldIndentWithTabs` and any extracted history save/restore helper.
- Co-locate per `AGENTS.md`; E2E under `packages/insomnia-smoke-test/`.
