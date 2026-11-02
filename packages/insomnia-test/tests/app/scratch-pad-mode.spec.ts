import { expect } from "@playwright/test";

import { test } from "@package/misc/fixtures";

test("Verify logging out shows the Scratch Pad and other login entry points, and choosing Scratch Pad opens its workspace with no Document creation entry", async ({
  user,
}) => {
  const { workspacePage, projectPage } = user.pageManager;

  await projectPage.logOut();
  const scratchPadEntryPointVisible = await projectPage.isLoginEntryPointVisible(
    "Use local Scratch Pad",
  );
  const emailEntryPointVisible = await projectPage.isLoginEntryPointVisible(
    "Continue with Email",
  );
  await projectPage.clickUseLocalScratchPad();
  const unlockFullFeaturesVisible =
    await projectPage.isUnlockFullFeaturesVisible();

  await user.page
    .getByRole("button", { name: "Create", exact: false })
    .first()
    .click();
  const createMenuLabels = await user.page
    .getByRole("menu")
    .getByRole("menuitemradio")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));

  expect(scratchPadEntryPointVisible).toBe(true);
  expect(emailEntryPointVisible).toBe(true);
  expect(unlockFullFeaturesVisible).toBe(true);
  expect(createMenuLabels.length).toBeGreaterThan(0);
  expect(
    createMenuLabels.some((label) => /document/i.test(label ?? "")),
  ).toBe(false);
});
