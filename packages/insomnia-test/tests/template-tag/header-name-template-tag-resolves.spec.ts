import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify a Header With a Templated Name Resolves and Sends Correctly", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    headers: [
      {
        name: "X-{% hash 'md5', 'hex', 'header-name' %}",
        value: "plain-value",
      },
    ],
  });
  const response = await httpRequestFlow.send(request!);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "x-7cd8e9f98e9104085ea06e39b87faf36": "plain-value",
    }),
  });
});
