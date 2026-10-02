import { expect, setKonnectEntitlement, test } from "../../misc/fixtures";

test.afterEach(async () => {
  await setKonnectEntitlement(false);
});

test("Verify the Konnect organization disappears from the organization switcher once the konnect-control-planes entitlement is revoked", async ({
  user,
}) => {
  const { konnectPage } = user.pageManager;

  await setKonnectEntitlement(true);
  await user.page.reload();
  await expect.poll(() => konnectPage.isTabVisible()).toBe(true);

  await setKonnectEntitlement(false);
  await user.page.reload();
  await expect.poll(() => konnectPage.isTabVisible()).toBe(false);
});
