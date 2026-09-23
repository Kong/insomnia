import { faker } from "@faker-js/faker";

import { DEFAULT_TIMEOUT,expect, test } from "../../misc/fixtures";

test("Verify configuring a Konnect PAT closes the settings modal, shows the Sync Konnect button, and leaves the Projects tab usable", async ({
  user,
}) => {
  const { konnectPage, workspacePage } = user.pageManager;

  await konnectPage.openTab();
  const introVisibleBeforeConfigure = await konnectPage.isIntroCardVisible();
  await konnectPage.clickConfigure();
  await konnectPage.setPat(`kpat_${faker.string.alphanumeric(20)}`);
  await konnectPage.clickConnectAndSync();
  const settingsModalOpenAfterConnect =
    await konnectPage.isSettingsModalOpen();
  await expect
    .poll(() => konnectPage.isSyncButtonVisible(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);

  await konnectPage.openProjectsTab();
  await workspacePage.navigate();

  expect(introVisibleBeforeConfigure).toBe(true);
  expect(settingsModalOpenAfterConnect).toBe(false);
});
