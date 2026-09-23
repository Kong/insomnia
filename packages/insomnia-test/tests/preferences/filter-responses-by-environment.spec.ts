import { expect, test } from "../../misc/fixtures";

test("Verify the 'Filter responses by environment' preference persists across closing and reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferencesPage } = user.pageManager;

  await preferencesPage.open();
  const enabledBeforeToggle =
    await preferencesPage.isFilterResponsesByEnvironmentEnabled();
  await preferencesPage.close();

  await preferencesFlow.set({ filterResponsesByEnv: !enabledBeforeToggle });

  await preferencesPage.open();
  const enabledAfterReopen =
    await preferencesPage.isFilterResponsesByEnvironmentEnabled();
  await preferencesPage.close();

  expect(enabledAfterReopen).toBe(!enabledBeforeToggle);
});
