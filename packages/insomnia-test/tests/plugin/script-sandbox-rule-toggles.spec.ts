import { expect } from "@playwright/test";

import { ScriptSandboxRuleGroup } from "@package/enums/script-sandbox-rule-group";
import { test } from "@package/misc/fixtures";

test("Verify Scripting tab rule-group sandbox toggles persist across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferencesPage, preferencesPluginsPage } = user.pageManager;

  await preferencesPage.open();
  await preferencesPluginsPage.openScriptingTab();
  const scopesInitial = await preferencesPluginsPage.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationInitial =
    await preferencesPluginsPage.isScriptSandboxRuleEnabled(
      ScriptSandboxRuleGroup.PrototypeMutation,
    );
  await preferencesPage.close();

  await preferencesFlow.toggleScriptSandboxRule(
    ScriptSandboxRuleGroup.Scopes,
    !scopesInitial,
  );
  await preferencesFlow.toggleScriptSandboxRule(
    ScriptSandboxRuleGroup.PrototypeMutation,
    !prototypeMutationInitial,
  );

  await preferencesPage.open();
  await preferencesPluginsPage.openScriptingTab();
  const scopesAfter = await preferencesPluginsPage.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationAfter =
    await preferencesPluginsPage.isScriptSandboxRuleEnabled(
      ScriptSandboxRuleGroup.PrototypeMutation,
    );
  await preferencesPage.close();

  expect(scopesAfter).toBe(!scopesInitial);
  expect(prototypeMutationAfter).toBe(!prototypeMutationInitial);
});
