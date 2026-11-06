# Migration: mcp-client / mock-server / git-sync flows
(pm = pageManager; all flow methods below now return Promise<void>)

## McpClientFlow
- callTool(client, tool, args, cb?, timeout?): Promise<ResponseView> -> void. Ends on response pane. Spec: `await mcpClient.callTool(...); const r = await pm.responsePage.get();`
- create(parent, client): Promise<McpClient> -> void. Spec keeps its own `client` model (no id). Resolve later by name (flows do).
- fetchOAuth2Tokens(client): Promise<OAuth2Tokens> -> void. Spec: `await mcpClient.fetchOAuth2Tokens(c); const t = await pm.mcpClientPage.auth.getOAuth2Tokens();` (Auth tab stays open)
- get(item) -> DELETED. Replacement: `await pm.workspacePage.findItemNode({name})` (undefined if missing) / `requireItemNode({name})`; URL: `await mcpClientFlow.connect`-less read = open node (`const n = await pm.workspacePage.requireItemNode(c); await pm.workspacePage.clickNode(n); await pm.mcpClientPage.navigate();`) then `await pm.mcpClientPage.getUrl()`. Node id = `node._id`.
- getTools(client) -> DELETED. Spec: open node as above (clickNode + mcpClientPage.navigate()) then `await pm.mcpClientPage.getTools()`.
- getListError(client, type) -> DELETED. Spec: open node as above, then `await pm.mcpClientPage.getCapabilityError(type)`.
- getListAction(client, type) -> DELETED. Spec: open node as above, then `await pm.mcpClientPage.getCapabilityActionName(type)`.
- (open node = after a prior flow call such as toggleCapability/refresh/loadMore/filterCapabilities/connect the node is already open and the page is navigated, so just call the page getter.)
- unchanged: disconnect, connect, toggleCapability, refresh, loadMore, filterCapabilities.

## MockServerFlow
- create(parent, server): Promise<MockServer> -> void (verifies node exists via workspacePage.requireItemNode).
- get(item) -> DELETED. Replacement: `await pm.workspacePage.findItemNode({name})` / `requireItemNode({name})`.
- duplicate(server, newName, targetProject?): Promise<MockServer> -> void (verifies new node exists). Reference the copy as `new MockServer(newName, url)`; flows resolve by name.
- createRoute(server, route): Promise<MockRoute> -> void. Route id is NOT returned; spec keeps its `route` model (no id). All route flow methods resolve id by `route.id ?? mockServerPage.findRouteId(route.path)` (route must be listed in the currently open server's sidebar).
- NEW openRoute(route): void. Opens route in already-open server view (resolve by id or path).
- editRoute(route, changes): Promise<MockRoute> -> void. Spec updates its own model afterwards: `route = { ...route, ...changes }` (do this so later calls resolve by the NEW path).
- deleteRoute(route): unchanged signature (now resolves by path when no id).
- setResponse(route): unchanged signature (resolves by path when no id).
- getRoutePaths(server) -> DELETED. Spec: `await mockServer.open(server); await pm.mockServerPage.getRoutePaths()`.
- getRoute(route) -> DELETED. Spec: `await mockServer.openRoute(route); await pm.mockServerPage.getOpenRoute()` ({method, path}).
- getUrl(route) -> DELETED. Spec: `await mockServer.openRoute(route); await pm.mockServerPage.showUrl()`.
- test(route): Promise<ResponseView> -> void. Ends on preview tab. Spec: `await mockServer.test(route); const r = await pm.responsePage.get();`
- createRouteFromResponse(server, path?): Promise<MockRoute> -> void. Spec: `await mockServer.createRouteFromResponse(server, path); const open = await pm.mockServerPage.getOpenRoute();` then route model = `{ path: open.path }` (id optional; `await pm.mockServerPage.findRouteId(open.path)` if wanted).
- getHistory(route) -> DELETED. Spec: `await mockServer.openRoute(route); const h = await pm.mockServerPage.getHistory();` (page method waits for first row; wrap in `expect(async () => {...}).toPass()` if a specific count is needed).
- unchanged: export, open, overwriteRouteFromResponse.

## GitSyncFlow
- commit / commitAndPush / commitStaged / commitStagedConfirmingUnknownFields: Promise<Commit> -> void. Commit read-back removed. Spec, if the commit id/message is needed:
  `await pm.gitSyncPage.openHistory(); const latest = await pm.gitHistoryDialogPage.getLatestCommit(); await pm.gitHistoryDialogPage.closeHistory();` (latest = {id, message} | undefined)
- getChanges() -> DELETED. Spec: `await pm.gitSyncPage.openCommitDialog(); const staged = await pm.gitCommitDialogPage.getStagedChanges(); const unstaged = await pm.gitCommitDialogPage.getUnstagedChanges(); await pm.gitCommitDialogPage.closeCommitDialog();`
- getBranches() -> DELETED. Spec: `await pm.gitSyncPage.openBranchesDialog(); const local = await pm.gitBranchesDialogPage.getLocalBranches(); const remote = await pm.gitBranchesDialogPage.getRemoteBranches(); await pm.gitBranchesDialogPage.closeBranchesDialog();`
- createBranchExpectingError(branch): Promise<string> -> void, and now LEAVES THE BRANCHES MODAL OPEN. Spec: `await git.createBranchExpectingError(b); const err = await pm.gitBranchesDialogPage.getNewBranchError(); await pm.gitBranchesDialogPage.closeBranchesDialog();`
- unchanged: switchBranch, stageChanges, unstageChanges, discardAllChanges, createBranch, checkoutRemoteBranch, fetch, pull, push, mergeBranch, mergeBranchResolvingConflicts, deleteBranch, discardChangeAfterReview, openVisualDiff, stageEntity, unstageEntity, discardEntity.
