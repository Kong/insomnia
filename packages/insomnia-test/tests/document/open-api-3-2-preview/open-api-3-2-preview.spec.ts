import { readFileSync } from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const readSpec = (fileName: string) =>
  JSON.stringify(
    JSON.parse(readFileSync(path.join(import.meta.dirname, fileName), "utf8")),
  );

test("Verify The Swagger UI Preview Lists QUERY And additionalOperations Methods", async ({
  user,
}) => {
  const { specFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      readSpec("additional-operations-3.2.json"),
    ),
  );
  const operations = await specFlow.getPreviewOperations();

  expect(operations).toEqual(
    expect.arrayContaining([
      { method: "QUERY", path: "/pets" },
      { method: "PURGE", path: "/pets" },
      { method: "LINK", path: "/pets" },
    ]),
  );
});
