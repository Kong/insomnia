import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify An Operation Header Overrides A Path Level Header With The Same Name In Different Casing", async ({
  user,
}) => {
  test.fail(true, "INS-4296");

  const { eventStreamRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await importFlow.importFile(
    project,
    path.join(import.meta.dirname, "header-name-casing.yaml"),
  );
  const request = await eventStreamRequestFlow.get(
    "Operation header with different casing",
  );

  const traceHeaders = request!.headers!.filter(
    (header) => header.name.toLowerCase() === "x-trace",
  );
  expect(traceHeaders).toEqual([
    expect.objectContaining({ name: "x-trace", value: "operation-level" }),
  ]);
});
