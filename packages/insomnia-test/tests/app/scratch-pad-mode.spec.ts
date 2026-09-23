import { expect, test } from "../../misc/fixtures";

test("Verify logging out shows the Scratch Pad and other login entry points, and choosing Scratch Pad opens its workspace with no Document creation entry", async ({
  user,
}) => {
  const { workspacePage } = user.pageManager;

  await workspacePage.logOut();
  const scratchPadEntryPointVisible = await workspacePage.isLoginEntryPointVisible(
    "Use local Scratch Pad",
  );
  const emailEntryPointVisible = await workspacePage.isLoginEntryPointVisible(
    "Continue with Email",
  );
  await workspacePage.clickUseLocalScratchPad();
  const unlockFullFeaturesVisible =
    await workspacePage.isUnlockFullFeaturesVisible();

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
