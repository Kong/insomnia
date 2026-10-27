import path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, test } from "../../../misc/fixtures";
import { Project } from "../../../models/project";

test("Verify the Variable Source Tooltip in the Manage Environments Modal Is Interactive and Its Open Action Selects the Source Environment Every Time", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, environmentFlow } = user.flowManager;
  const { environmentPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "collection-source-environments.yaml"),
  );
  const collection = await workspaceFlow.getCollection("Tooltip Source Collection");
  await environmentFlow.activate(collection!, "SubEnvA");
  await environmentPage.openCollectionEnvironmentEditor();
  await environmentPage.selectEnvironmentInDialog("SubEnvA");

  const tooltipText = await environmentPage.hoverVariableSource("baseOnlyVar", true);
  await environmentPage.openVariableSource();
  await expect
    .poll(() => environmentPage.isEnvironmentRowSelected("Base Environment", true), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  const dialogCountAfterFirstOpen = await environmentPage.countManageEnvironmentsDialogs();

  await environmentPage.selectEnvironmentInDialog("SubEnvA");
  await environmentPage.hoverVariableSource("baseOnlyVar", true);
  await environmentPage.openVariableSource();
  await expect
    .poll(() => environmentPage.isEnvironmentRowSelected("Base Environment", true), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);

  expect(tooltipText).toContain("baseOnlyValue");
  expect(dialogCountAfterFirstOpen).toBe(1);
});
