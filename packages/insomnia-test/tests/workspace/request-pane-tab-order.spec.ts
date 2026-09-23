import { faker } from "@faker-js/faker";

import { ContextMenuItem } from "../../enums/context-menu-items";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify a freshly created request focuses the URL bar and Tab/arrow-key order flows through Send, its dropdown, and the request tabs", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const collectionNode = await workspacePage.resolveNode(collection);
  await workspacePage.rightClick(collectionNode);
  await workspacePage.clickContextMenu(ContextMenuItem.HttpRequest);
  await httpRequestPage.navigate();
  await expect(async () => {
    expect(await httpRequestPage.hasFocus(httpRequestPage.urlBarContainer)).toBe(true);
  }).toPass({ timeout: 5000 });
  const urlBarFocusedAfterCreate = await httpRequestPage.hasFocus(
    httpRequestPage.urlBarContainer,
  );

  await user.page.keyboard.press("Tab");
  const sendFocusedAfterFirstTab = await httpRequestPage.isFocused(
    httpRequestPage.sendButton,
  );
  await user.page.keyboard.press("Tab");
  await user.page.keyboard.press("Tab");
  const paramsTab = user.page.getByRole("tab", { name: "Params" });
  const paramsTabFocusedAfterThirdTab = await httpRequestPage.isFocused(paramsTab);
  const paramsTabFocusVisible = paramsTab;
  await user.page.keyboard.press("ArrowRight");
  const bodyTab = user.page.getByRole("tab", { name: "Body" });
  const bodyTabFocusedAfterArrowRight = await httpRequestPage.isFocused(bodyTab);

  expect(urlBarFocusedAfterCreate).toBe(true);
  expect(sendFocusedAfterFirstTab).toBe(true);
  expect(paramsTabFocusedAfterThirdTab).toBe(true);
  await expect(paramsTabFocusVisible).toHaveAttribute("data-focus-visible", "true");
  expect(bodyTabFocusedAfterArrowRight).toBe(true);
});
