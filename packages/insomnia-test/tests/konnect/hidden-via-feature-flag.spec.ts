import { expect, setKonnectSyncFeatureFlag,test } from "../../misc/fixtures";

test.afterEach(async () => {
  await setKonnectSyncFeatureFlag(true);
});

test("Verify the Konnect sidebar tab hides once the konnectSync org feature flag is disabled", async ({
  user,
}) => {
  const { konnectPage } = user.pageManager;

  await setKonnectSyncFeatureFlag(false);
  await user.page.reload();

  await expect.poll(() => konnectPage.isTabVisible()).toBe(false);
});
