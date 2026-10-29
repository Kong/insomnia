import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../../enums/project-types";
import { test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

test("Verify the tag modal's source follows the edited template and hides for non-variable content", async ({
  user,
}) => {
  const { workspaceFlow, importFlow, environmentFlow, httpRequestFlow, variableSourceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  await importFlow.importFile(
    project,
    path.join(__dirname, "environment-cascade-collection.yaml"),
  );
  const collection = new Collection("Environment Cascade");
  await environmentFlow.activate(collection, "Base Environment");

  await httpRequestFlow.get("cascade request");
  const initial = await variableSourceFlow.inspectVariableModal("cascadeVar", "fromFolder");
  const switched = await variableSourceFlow.selectModalVariable(
    "{{ _.subOnlyVar }}",
    "subOnly_base",
  );
  await variableSourceFlow.selectModalVariable(
    { label: "-- Custom --" },
    "Failed to render environment variables: 'my custom template logic'",
  );
  const plainText = await variableSourceFlow.setModalTemplate("plain text", "plain text");
  const inheritedKey = await variableSourceFlow.setModalTemplate("{{ constructor }}");
  const padded = await variableSourceFlow.setModalTemplate("{{  _.subOnlyVar  }}", "subOnly_base");
  await variableSourceFlow.openSourceFromModal();
  const navigation = await variableSourceFlow.getNavigation(
    "environments-modal",
    "Base Environment",
  );

  expect(initial.source).toContain("Folder Environment : cascadeFolder");
  expect(switched.source).toContain("Collection Environment : Base Environment");
  expect(plainText.source).toBeUndefined();
  expect(inheritedKey.source).toBeUndefined();
  expect(padded.source).toContain("Collection Environment : Base Environment");
  expect(navigation.selectedEnvironmentRow).toBe(true);
  expect(navigation.manageEnvironmentsModalCount).toBe(1);
});
