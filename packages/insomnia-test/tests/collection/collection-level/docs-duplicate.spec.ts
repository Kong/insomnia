import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

const DOCS = "# Collection docs\n\nShared by **every** request.";

test("Collection Docs survive duplicating the collection to another project", async ({ user }) => {
  const { collectionFlow, workspaceFlow } = user.flowManager;
  const target = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const { collection } = await createFixture(user.flowManager);
  await collectionFlow.setDocs(collection, DOCS);

  const copy = await workspaceFlow.duplicateCollection(collection, `${collection.name} Copy`, target);

  expect(await collectionFlow.getDocs(copy)).toBe(DOCS);
});
