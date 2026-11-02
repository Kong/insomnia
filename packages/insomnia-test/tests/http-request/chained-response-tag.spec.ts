import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const url = `${HTTP_SERVER}/post`;
const bodyJsonPathFilter = "b64::JC5kYXRh::46b";

test("Verify A Response Tag Chain Resolves Through Multiple Requests", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const first = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: { mimeType: ContentType.Plain, text: "first" },
  });
  const second = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.Plain,
      text: `{% response 'body', '${first.id}', '${bodyJsonPathFilter}', 'always', 60 %} and second`,
    },
  });
  const third = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body: {
      mimeType: ContentType.Plain,
      text: `{% response 'body', '${second.id}', '${bodyJsonPathFilter}', 'always', 60 %} and third`,
    },
  });

  const responseView = await httpRequestFlow.send(third);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({ data: "first and second and third" });
});
