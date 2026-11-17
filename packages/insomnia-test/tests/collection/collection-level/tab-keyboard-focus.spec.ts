import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import type { CollectionPage } from "@package/pages/collection.page";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

/** Waits until `tab` holds keyboard (focus-visible) focus, then returns its computed box-shadow. */
async function keyboardFocusShadow(page: CollectionPage, tab: string): Promise<string> {
  await expect
    .poll(async () => {
      const { focused, focusVisible } = await page.getTabFocusIndicator(tab);
      return { focused, focusVisible };
    }, { timeout: DEFAULT_TIMEOUT })
    .toEqual({ focused: true, focusVisible: true });
  return (await page.getTabFocusIndicator(tab)).boxShadow;
}

test("Collection tabs show a focus ring when focused with the keyboard", async ({ user }) => {
  test.fail(true, "INS-4336");
  const { collectionFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);
  const page = await collectionFlow.open(collection);

  // Spec: one of the original tabs, which had a focus ring before the new tabs were added.
  await page.moveTabFocusWithKeyboard("auth", "ArrowLeft");
  expect(await keyboardFocusShadow(page, "spec")).not.toBe("none");

  // Auth: one of the new collection-level tabs.
  await page.moveTabFocusWithKeyboard("spec", "ArrowRight");
  expect(await keyboardFocusShadow(page, "auth")).not.toBe("none");
});

test("Docs tab can be reached from the Environment tab with the arrow keys", async ({ user }) => {
  test.fail(true, "INS-4339");
  const { collectionFlow } = user.flowManager;
  const { collection } = await createFixture(user.flowManager);
  const page = await collectionFlow.open(collection);

  // Scripts -> Environment
  await page.moveTabFocusWithKeyboard("scripts", "ArrowRight");
  await expect.poll(() => page.getSelectedTabKey(), { timeout: DEFAULT_TIMEOUT }).toBe("environment");

  // Environment -> Docs
  await page.pressKey("ArrowRight");
  await expect.poll(() => page.getSelectedTabKey(), { timeout: DEFAULT_TIMEOUT }).toBe("docs");
});
