import { ScriptSandboxRuleGroup } from "@package/enums/script-sandbox-rule-group";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

test("Verify Scripting tab rule-group sandbox toggles persist across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferences, preferencesPlugins } = user.pageManager;

  await preferences.open();
  await preferencesPlugins.openScriptingTab();
  const scopesInitial = await preferencesPlugins.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationInitial =
    await preferencesPlugins.isScriptSandboxRuleEnabled(
      ScriptSandboxRuleGroup.PrototypeMutation,
    );
  await preferences.close();

  await preferencesFlow.toggleScriptSandboxRule(
    ScriptSandboxRuleGroup.Scopes,
    !scopesInitial,
  );
  await preferencesFlow.toggleScriptSandboxRule(
    ScriptSandboxRuleGroup.PrototypeMutation,
    !prototypeMutationInitial,
  );

  await preferences.open();
  await preferencesPlugins.openScriptingTab();
  const scopesAfter = await preferencesPlugins.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationAfter =
    await preferencesPlugins.isScriptSandboxRuleEnabled(
      ScriptSandboxRuleGroup.PrototypeMutation,
    );
  await preferences.close();

  expect(scopesAfter).toBe(!scopesInitial);
  expect(prototypeMutationAfter).toBe(!prototypeMutationInitial);
});
