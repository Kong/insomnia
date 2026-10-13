import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const bodyJsonPathFilter = "b64::JC5kYXRh::46b";

test("Verify A Response Tag Chain Resolves Through Multiple Requests", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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

  const response = await httpRequestFlow.send(third);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ data: "first and second and third" });
});
