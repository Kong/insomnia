import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Project } from "../../models/project";

test("Verify Renaming And Deleting A Project Via The Dashboard", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;

  const oldName = faker.string.alphanumeric(10);
  const newName = faker.string.alphanumeric(10);
  const project = await workspaceFlow.create(
    new Project(oldName, ProjectType.Local),
  );

  const renamed = await workspaceFlow.renameProject(project, newName);
  const foundByNewName = await workspaceFlow.getProject(newName);
  const foundByOldName = await workspaceFlow.getProject(oldName);

  await workspaceFlow.delete(renamed);

  expect(foundByNewName?.id).toBe(project.id);
  expect(foundByOldName).toBeUndefined();
  await expect
    .poll(() => workspaceFlow.getProject(newName), { timeout: 10_000 })
    .toBeUndefined();
});
