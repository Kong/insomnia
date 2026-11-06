import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const filePath = path.join(import.meta.dirname, "fixture.txt");

test("Verify the file Tag Reads Contents from an Allowed Folder", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow, templateTagFlow } =
    user.flowManager;

  await preferencesFlow.set({ dataFolders: [import.meta.dirname] });

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const fileTag = `{% file '${filePath}' %}`;
  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: fileTag,
  });

  const result = await templateTagFlow.get(fileTag);

  expect(result.preview).toBe("hello-from-file-tag");
});
