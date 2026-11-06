# Migration: flows/workspace.flow.ts (WorkspaceFlow)

All public methods now return Promise<void>. `wf` = workspaceFlow, `ws` = pageManager.workspacePage, `sp` = pageManager.specPage.
Create/rename/duplicate flows now verify the node exists in the tree (ws.requireItemNode) and throw otherwise; pass model objects built up front (no _id needed).
Removed exported types: WorkspaceItem, UnitTestRunResult (RequestFlows kept; unused now by the class, still used by flow-manager).

## Changed to void (same args)
- createProject(item) -> void
- openLocalGitFolder(item) -> void
- cloneGitProject(item, credentialName, repo?) -> void
- createCollection(parent, item, fileName?) -> void. With item.spec the spec page is left open (as before).
- createMcpClient(parent, item) -> void
- createEnvironment(parent, item) -> void
- createInEmptyState(parent, collection) -> void
- renameProject(project, newName) -> void (build the renamed model yourself: new Project(newName, type))
- duplicateCollection / duplicateMcpClient / duplicateEnvironment(item, newName, targetProject?) -> void (duplicateEnvironment no longer returns containerName)
- duplicateRequest(item, newName), renameRequest(item, newName) -> void (old return {id,name}; use the names you passed)
- renameCollection / renameMcpClient / renameEnvironment(item, newName) -> void
- run(collection, options?) -> void. Read results afterwards: `pageManager.runnerPage.getTestResultCount()` and `pageManager.runnerPage.getIterationResultsByFilter()` (Runner page is left open with finished results).
- runAllTests(testSuite) -> void. Read: `sp.getTestResultSummary()` and `sp.getTestResultRows()` (spec page stays open on the suite).
- dismissFocusModePrompt(): Promise<boolean> -> void. To know if it was shown, call `ws.isFocusModePromptShown()` BEFORE calling the flow.
- uploadRuleset(filePath, expectCode?): Promise<string[]|'invalid'> -> void. Accepted: lint panel left expanded, read `sp.getLintEntryCodes()`. Rejected: error dialog is LEFT OPEN; check `await sp.isInvalidRulesetDialogShown()` (NEW page method) then `wf.closeDialog()`.

## Renamed / split
- cloneWithScanReport(item, cred, repo?) -> `wf.scanGitProjectClone(item, cred, repo?)` (stops on post-scan screen), then read `pageManager.projectSettingsPage.getUnknownFieldFiles()` / `.getUnknownFieldsWarningText()`, then `wf.confirmGitProjectClone(item)` (clicks confirm, waits for the project node).
- generateCode(request, options?) -> `wf.openGenerateCode(request, options?)` (void, dialog left open), then `await ws.getGeneratedCode()`.
- getTestSuite(item, suiteName) -> `wf.openTests(item)` (now PUBLIC, void; collection or name) then `sp.selectTestSuite(suiteName)`, `sp.getSelectedTestSuiteName()`, `sp.getUnitTestNames()`.
- getTestSuiteNames(item) -> `wf.openTests(item)` then `sp.getTestSuiteNames()`.
- getCollectionSpec(item) -> `wf.openSpec(item)` (NEW, void; navigates to the collection's spec page; after createCollection with spec you are already there) then `sp.getSpecification()`, `sp.getRulesetType()`, `sp.getOpenApiVersion()`.
- getLintState(minLintErrors = 0) -> `sp.getSettledLintState(minLintErrors = 0)` (NEW page method, same return {errors, warnings, entries}). Must be on the spec page (after wf.openSpec / createCollection with spec).

## Deleted (pure reads)
- search(query) -> `pageManager.commandPalettePage.open(); .search(query); await .getResultNames()`
- get(item, parent?) / getByPalette(name) -> deleted. Use `ws.findItemNode({name,id?}, type?, parentNode?)` (undefined if absent) or `ws.requireItemNode(...)`; to navigate by palette: `commandPalettePage.open(); .search(name); .selectResult(name)`. Kind discrimination: `ws.getWorkspaceItemKind(node)` / `ws.getRequestTypeLabel(node)`. For request data use the per-protocol request flow's own page reads (other agents).
- getCollection(item) -> `ws.findItemNode(item)` (existence/id: node._id)
- getProject(item) -> `ws.findItemNode(item)` (public method removed; getEnvironment/getMcpClient/getResolved private helpers also removed)
- getEnvironment / getMcpClient were private; gone.
