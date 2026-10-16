import { faker } from "@faker-js/faker";

import { ProjectType } from "../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../misc/fixtures";
import { Collection } from "../../../../models/collection";
import type { CurlCommand } from "../../../../models/curl-command";
import { Project } from "../../../../models/project";

const firstUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
const secondUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
const command = `curl -X GET "${firstUrl}" ; curl -X GET "${secondUrl}"`;

test("Import HTTP Request by Curl Command With Semicolon-Separated Commands Imports Both", async ({
  user,
}) => {
  const { importFlow, workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const curl: CurlCommand = { command };
  await importFlow.importCurl(project, collection, curl);

  expect(await httpRequestFlow.get(firstUrl)).toMatchObject({
    name: firstUrl,
  });
  expect(await httpRequestFlow.get(secondUrl)).toMatchObject({
    name: secondUrl,
  });
});
