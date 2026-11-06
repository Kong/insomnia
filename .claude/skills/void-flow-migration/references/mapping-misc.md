# Migration: misc flows (app, cookie, preferences, certificates, cloud-sync, export, import, organization, template-tag, variable-source, environment, folder)
Unchanged (already void): certificates.flow.ts, export.flow.ts, import.flow.ts, organization.flow.ts, other cloud-sync methods.
`fm` = user.flowManager, `pm` = user.pageManager.

## AppFlow (flows/app.flow.ts)
- appFlow.restart(): Promise<Page> -> Promise<void>. No window accessor needed: pm.setWindow(newWin) rewires every page/component reachable from `pm` in place (pages/components already obtained before restart stay valid; components are rebuilt so re-read them from pm). `user.page` (fixture `window`) is STALE after restart (closed window) - don't use it after restart; use pm pages.
- appFlow.getDataPath() -> DELETED; use `await user.flowManager.context.getDataPath()` (FlowContext/SessionContext, already existed).
- appFlow.getStdoutListenerCount(event) -> DELETED; use `await user.flowManager.context.getStdoutListenerCount(event)` (new on FlowContext + SessionContext).
- appFlow.isAlive() -> DELETED; use `await user.flowManager.context.isAlive()` (new).
- appFlow.captureMainProcessLog(action) -> DELETED; use `await user.flowManager.context.captureMainProcessLog(action)` (new, same behavior; process handle taken at call start, so a restart inside `action` is not followed - same as before).
- unchanged void: emitStdoutEpipeError, simulateMainWindowFocusChange, closeHiddenScriptWindow.

## CookieFlow
- cookieFlow.link(item, cookies): Promise<Cookie[]> -> Promise<void> (still waits until jar lists the cookies). To read: open jar then `pm.cookiePage.open(); await pm.cookiePage.getCookies(); await pm.cookiePage.close()` after `workspacePage.clickNode(await workspacePage.resolveNode(item))`.

## PreferencesFlow
- preferencesFlow.set(settings): Promise<Settings> -> Promise<void>. aiUrlBackend result no longer returned. To read persisted AI config: `pm.preferences.open(); pm.preferencesAi.openAiSettingsTab(); await pm.preferencesAi.getUrlBackendFormValues("LLM URL Active" /* "LLM URL" when inactive */); pm.preferences.close()` (returns {url, model, apiKey, temperature, topP, maxTokens} as strings -> Number() them). Active state: `pm.preferencesAi.isAiBackendActive("LLM URL")`. set() now also waits for the backend to show Active after activation / not Active after `aiUrlBackend: null`.
- preferencesFlow.getInstalledPlugins(): DELETED; replacement: `await pm.preferences.open(); await pm.preferencesPlugins.openPluginsTab(); const names = await pm.preferencesPlugins.getPluginNames(); await pm.preferences.close();`
- preferencesFlow.generateVaultKey(): Promise<string> -> Promise<void>. Read key: `await pm.preferences.open(); const key = await pm.preferencesVault.getVaultKey(); await pm.preferences.close();`
- preferencesFlow.resetVaultKey(): Promise<string> -> Promise<void>. Read new key same way as above.
- preferencesFlow.enterVaultKey(key): Promise<string|null> -> Promise<void>; on rejection it closes modal+Preferences and THROWS Error(message) (like createPlugin): `await expect(preferencesFlow.enterVaultKey("bad")).rejects.toThrow("Invalid vault key, please check and input again")`. Success = resolves.
- unchanged void: createPlugin (throws on invalid name), toggleScriptSandboxRule, addGitCredential.

## CloudSyncFlow
- cloudSyncFlow.mergeBranchResolvingConflicts(branch, version): Promise<string[]> -> DELETED. Replaced by two void flow methods:
  `cloudSyncFlow.mergeBranchExpectingConflicts(branch)` (opens Branches dialog, merges, leaves "Resolve conflicts" modal open) then
  `cloudSyncFlow.resolveMergeConflicts(version: "Current"|"Incoming")` (resolves all, closes dialog).
  Conflict names (between the two calls): `await pm.cloudSyncBranchesDialogPage.getMergeConflictNames()` (new page method, returns string[]).
- pm.cloudSyncBranchesDialogPage.resolveMergeConflicts(version): Promise<string[]> -> Promise<void> (use getMergeConflictNames for names).

## TemplateTagFlow
- templateTagFlow.get(template): Promise<TemplateTag> -> DELETED; use `await pm.templateTagPage.readTag(template)` (new page method, returns TemplateTag {functionName, preview, algorithm?, digestEncoding?, input?}; opens tag, reads, clicks Done; accepts the same `template` string incl. surrounding text).
- templateTagFlow.edit(template, target): Promise<TemplateTag> -> Promise<void>. Preview/args after edit are no longer returned. To assert afterwards re-open with the NEW tag text: `pm.templateTagPage.readTag(newTemplate)` (e.g. hash: build "{% hash 'sha256', 'hex', 'hello' %}"), or assert via the sent response. For vault tags the new raw text embeds the credential id (not known up front) so assert via the response (`httpRequestFlow.send(...)` then `pm.responsePage.get()`) instead of `.preview`.
- templateTagFlow.sendAnsweringPrompt(request, label, value): Promise<{promptInputType, response}> -> Promise<void>; ends with response pane shown: read response with `await pm.responsePage.get()`.
  Input type: split flow = `templateTagFlow.sendAwaitingPrompt(request)` (opens request, clicks Send, leaves prompt dialog open) -> `await pm.templateTagPage.getPromptInputType(label)` (new, returns e.g. "password") -> `templateTagFlow.answerPrompt(label, value)` (new, answers + shows response pane).
- pm.templateTagPage.answerPrompt(label, value): Promise<string> -> Promise<void> (use getPromptInputType).
- unchanged void: clearCachedPrompt.

## VariableSourceFlow (all former returns now void; read via pm.variableSourcePage)
- inspectVariableModal(snippet, expectedPreview): Promise<VariableSourceModal> -> void; read `await pm.variableSourcePage.readVariableModal()` ({source?, preview}) right after (before openSourceFromModal).
- inspectEnvironmentPageVariable(snippet, expectedPreview): same as above.
- selectModalVariable(option, expectedPreview?) / setModalTemplate(template, expectedPreview?): Promise<VariableSourceModal> -> void; read `pm.variableSourcePage.readVariableModal()` afterwards.
- hoverVariable(snippet) / hoverEnvironmentPageVariable(snippet): Promise<{tooltip,chip}> -> void; read `await pm.variableSourcePage.readHoveredVariable(snippet)` -> {tooltip, chip}.
- hoverVariableInModal(snippet, scope="modal"): -> void; read `await pm.variableSourcePage.readHoveredVariable(snippet, "modal")`.
- hoverTooltipContent(snippet): Promise<boolean> -> void; read `await pm.variableSourcePage.isTooltipVisible()` (new).
- hoverBetweenVariables(first, firstExpected, second, secondExpected): Promise<{first,second}> -> void. Each hover already waits for tooltip to contain the expected text (that is the "first contains" assertion); read second with `await pm.variableSourcePage.readTooltip()` (new) and assert toContain(secondExpected).
- getNavigation(landing, environmentRow?): DELETED from flow; `await pm.variableSourcePage.getNavigation(landing, environmentRow)` (moved to page, same result shape).
- Types VariableSourceLanding / VariableSourceNavigation moved: `import type { VariableSourceLanding } from "@package/pages/variable-source.page"` (was flows/variable-source.flow). Spec variable-source-levels.spec.ts imports it - update.
- pm.variableSourcePage.hoverVariable(snippet, scope): Promise<{tooltip,chip}> -> Promise<void>; pm.variableSourcePage.isTooltipKeptOnHover() -> DELETED (replaced by hoverTooltip() + isTooltipVisible()); hoverVariableUntilTooltipContains -> Promise<void>.
- unchanged void: openSourceFromModal, openSourceFromTooltip, selectProjectEnvironment, openManageEnvironmentsModal, selectModalEnvironment, waitForManageEnvironmentsModalClosed.

## EnvironmentFlow
- environmentFlow.createBaseEnvironment(parent, env): Promise<Environment> -> Promise<void>. Spec builds `const environment = new Environment({...})` up front and passes it; it no longer gets a returned copy (no id). Ends with requireItemNode(name).
- environmentFlow.createSubEnvironment(parent, env): Promise<Environment> -> Promise<void>. `parent` is unused for lookup. If the sub env will be passed to link(), build it with `containerName: <base env name>` (previously inherited from the returned parent).
- environmentFlow.link(item, env): no signature change, but no longer requires `containerName` (defaults to `env.name`, correct for base environments). Sub-environments MUST carry containerName = base environment name.
- environmentFlow.get(item): DELETED; use `await pm.environmentPage.getEnvironmentVariables(name)` (new; returns EnvironmentKvPairData[] | undefined if not listed) -> old `.kvPairData`. Env id: `pm.environmentPage.getEnvironmentId(name)`.
- environmentFlow.getOpenPickersAfterOpening(collection, picker): Promise<...[]> -> DELETED; `await workspacePage.clickNode(await workspacePage.resolveNode(collection)); await pm.environmentPage.getOpenPickersAfterOpening(picker)` (new page method; opens, reads, closes).
- environmentFlow.addProjectEnvironmentFromPicker(collection, name): Promise<{selected,options}> -> Promise<void>; read `await pm.environmentPage.getProjectEnvironmentPickerState()` afterwards.
- environmentFlow.createCollectionSubEnvironment(collection, env): Promise<{isPrivate}> -> Promise<void> (closes the manager); read privacy: `await pm.environmentPage.openCollectionEnvironmentManager(); const isPrivate = await pm.environmentPage.isEnvironmentPrivate(env.name); await pm.environmentPage.closeCollectionEnvironmentManager();` (collection must be open: clickNode first).
- unchanged void: activate.

## FolderFlow
- folderFlow.create(parent, folder): Promise<Folder> -> Promise<void> (waits via workspacePage.requireItemNode({name}, TreeNodeType.Folder)). Build `new Folder(name)` up front; flows resolve by name (id optional). Private get() removed.
- folderFlow.open(folder): Promise<FolderPage> -> Promise<void>; use `pm.folderPage` afterwards.
- folderFlow.fetchOAuth2Tokens(folder): Promise<OAuth2Tokens> -> Promise<void>; read `await pm.folderPage.auth.getOAuth2Tokens()`.
- unchanged void: setScripts, setEnvironmentVariables.

## Non-flow files touched
- misc/flow-context.ts, misc/session-context.ts: added getStdoutListenerCount, isAlive, captureMainProcessLog (getDataPath already there).
- pages/cloud-sync-branches-dialog.page.ts, pages/template-tag.page.ts, pages/variable-source.page.ts, pages/environment.page.ts: methods noted above.
