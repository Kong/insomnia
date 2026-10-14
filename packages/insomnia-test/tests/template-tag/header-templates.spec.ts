import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify a Header With a Template Tag in Its Value", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    headers: [
      {
        name: "X-Header-Name",
        value: "{% base64 'encode', 'normal', 'header-value' %}",
      },
    ],
  });
  const responseView = await httpRequestFlow.send(request!);

  expect(responseView.body).toMatchObject({
    headers: expect.objectContaining({
      "x-header-name": "aGVhZGVyLXZhbHVl",
    }),
  });
});
