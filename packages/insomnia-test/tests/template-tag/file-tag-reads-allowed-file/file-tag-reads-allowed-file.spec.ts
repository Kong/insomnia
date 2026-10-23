import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../enums/http-method";
import { ProjectType } from "../../../enums/project-types";
import { expect, test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

const filePath = path.join(__dirname, "fixture.txt");

test("Verify the file Tag Reads Contents from an Allowed Folder", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow, templateTagFlow } =
    user.flowManager;

  await preferencesFlow.set({ dataFolders: [__dirname] });

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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
