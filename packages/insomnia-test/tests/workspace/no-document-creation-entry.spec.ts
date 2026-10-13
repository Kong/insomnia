import { faker } from "@faker-js/faker";

import { ContextMenuItem } from "../../enums/context-menu-items";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Project } from "../../models/project";

test("Verify the project row's creation context menu offers API Collection but no separate Document option", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const projectNode = await workspacePage.resolveNode(project);
  await workspacePage.rightClick(projectNode);
  const menu = user.page.getByRole("menu");
  const menuItemLabels = await menu
    .getByRole("menuitem")
    .or(menu.getByRole("menuitemradio"))
    .allInnerTexts();

  expect(menuItemLabels).toContain(ContextMenuItem.Collection);
  expect(menuItemLabels.some((label) => /document/i.test(label))).toBe(
    false,
  );
});
