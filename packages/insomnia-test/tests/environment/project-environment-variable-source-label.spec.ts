import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, expect, test } from "../../misc/fixtures";
import {
  ENVIRONMENT_TYPE,
  EnvironmentKvPairDataType,
} from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Variables on the Project Environment Page Are Attributed to the Project Environment and Opening Their Source From the Manage Environments Modal Closes It", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow } = user.flowManager;
  const { environmentPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const baseName = faker.string.alphanumeric(10);
  const subName = faker.string.alphanumeric(10);
  const baseVariable = `base_${faker.string.alphanumeric(8)}`;
  const baseEnvironment = await environmentFlow.create(project, {
    name: baseName,
    type: ENVIRONMENT_TYPE,
    kvPairData: [
      {
        id: "",
        name: baseVariable,
        value: faker.string.alphanumeric(8),
        type: EnvironmentKvPairDataType.STRING,
      },
    ],
  });
  await environmentFlow.create(baseEnvironment, {
    name: subName,
    kvPairData: [
      {
        id: "",
        name: `ref_${faker.string.alphanumeric(8)}`,
        value: `{{ _.${baseVariable} }}`,
        type: EnvironmentKvPairDataType.STRING,
      },
    ],
  });
  await environmentPage.selectEnvironment(subName);

  const pageTooltip = await environmentPage.hoverVariableSource(baseVariable);

  await environmentPage.openManageEnvironmentsDialogByShortcut();
  await environmentPage.selectEnvironmentInDialog(subName);
  await environmentPage.hoverVariableSource(baseVariable, true);
  await environmentPage.openVariableSource();

  expect(pageTooltip).toContain(`Project Environment : ${baseName}`);
  expect(pageTooltip).not.toContain("Collection Environment");
  await expect
    .poll(() => environmentPage.countManageEnvironmentsDialogs(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(0);
  await expect
    .poll(() => environmentPage.isEnvironmentRowSelected(baseName), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
});
