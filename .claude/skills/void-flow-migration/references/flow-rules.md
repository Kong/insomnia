# Convention: every public flow method returns Promise<void>

Repo: /Users/bob.qiu/Desktop/works/insomnia/packages/insomnia-test (ONLY this package; never touch works/insomnia-test).
Layers: spec -> flow (flows/*.flow.ts) -> page (pages/*.page.ts) -> component (components/*.component.ts); models/ = input data.
Type-check: `cd packages/insomnia-test && npx tsc --noEmit -p . 2>&1 | head -80` (6s, baseline was clean).
Do NOT reformat unrelated code, do NOT refactor unrelated code. Follow existing style (double quotes, @step() decorator, doc comments). Do not git commit.

## Rules for flows
1. Every PUBLIC method of a flow class (flows/*.flow.ts) must have return type `Promise<void>` and return nothing.
   Private/protected helpers (incl. BaseFlow.assertCreated etc.) may keep return values.
2. Action methods that returned an entity / response / page (create*, rename*, duplicate*, commit*, send, disconnect, sendMessage,
   fetchOAuth2Tokens, run, restart, open, ...): keep the UI actions, drop the data read-back + return.
   - Where the old code ended with `assertCreated(await this.get(...))` as an implicit "it was created" check, replace it with a cheap
     void verification that still fails if the item is missing (e.g. `await workspace.requireItemNode(...)` / wait for the node), not a model read.
   - The flow must leave the UI in the same state as before (e.g. `send` ends with the response pane shown), so a spec can read the result
     straight afterwards from a page (e.g. `pageManager.responsePage.get()`).
3. Pure read methods (get*, is*, read*, getChanges, getBranches, getTools, getRoutePaths, search, generateCode, getLintState, ...):
   DELETE them from the flow. Reading data is the spec's job via pageManager pages (page/component methods may return values).
   If a deleted read had valuable multi-step logic that only touches ONE page, move it into that page class as a method (returns allowed there).
   Never leave dead code behind; if another flow calls the deleted method internally, rewrite that caller to use pages directly.
4. Mixed methods (act + read, e.g. fetchOAuth2Tokens, runAllTests, uploadRuleset, cloneWithScanReport, dismissFocusModePrompt returning boolean):
   the flow does the action only (void); the read part is exposed through page methods (add a page method if one does not exist).
5. Update the doc comments of changed methods (no longer says "returns ...").
6. Models (models/*.ts) are inputs only. Specs will build model objects up front (new Collection(...)) and pass them to flows; flows resolve
   them by name/id (`workspace.resolveNode`, `requireItemNode`). Make sure the flows still work when the passed model has no `_id`.
7. Record every deleted/changed signature (old signature -> new, or "deleted; replacement = page.method()") in a file listed in your task:
   it is the migration guide the spec-fixing agents will use. Be precise and exact on page method names/paths for replacements.

Scope: only edit the flow files you own, plus add small methods to page/component files when needed (use targeted Edit calls; other agents edit other
parts of the same page files concurrently, so never rewrite whole files). Other flow files may have type errors caused by methods another agent is
removing - ignore errors in files you do not own and errors in tests/. At the end run tsc and make sure YOUR files have no errors.
