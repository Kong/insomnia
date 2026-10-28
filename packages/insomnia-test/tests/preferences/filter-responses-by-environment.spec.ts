import { expect } from "@playwright/test";

import { test } from "../../misc/fixtures";

test("Verify the 'Filter responses by environment' preference persists across closing and reopening Preferences", async ({
  user,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { preferences } = user.pageManager;

  await preferences.open();
  const enabledBeforeToggle =
    await preferences.isFilterResponsesByEnvironmentEnabled();
  await preferences.close();

  await preferencesFlow.set({ filterResponsesByEnv: !enabledBeforeToggle });

  await preferences.open();
  const enabledAfterReopen =
    await preferences.isFilterResponsesByEnvironmentEnabled();
  await preferences.close();

  expect(enabledAfterReopen).toBe(!enabledBeforeToggle);
});
