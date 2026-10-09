import { ScriptSandboxRuleGroup } from "../../enums/script-sandbox-rule-group";
import { expect, test } from "../../misc/fixtures";

test("Verify Scripting tab rule-group sandbox toggles persist across reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferencesPage } = user.pageManager;

  await preferencesPage.open();
  await preferencesPage.openScriptingTab();
  const scopesInitial = await preferencesPage.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationInitial =
    await preferencesPage.isScriptSandboxRuleEnabled(
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
  await preferencesPage.openScriptingTab();
  const scopesAfter = await preferencesPage.isScriptSandboxRuleEnabled(
    ScriptSandboxRuleGroup.Scopes,
  );
  const prototypeMutationAfter =
    await preferencesPage.isScriptSandboxRuleEnabled(
      ScriptSandboxRuleGroup.PrototypeMutation,
    );
  await preferencesPage.close();

  expect(scopesAfter).toBe(!scopesInitial);
  expect(prototypeMutationAfter).toBe(!prototypeMutationInitial);
});
