import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify GraphQL Request Header With a Template Tag Is Resolved", async ({
  user,
}) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body,
    headers: [
      {
        name: "X-Header-Name",
        value: "{% base64 'encode', 'normal', 'header-value' %}",
      },
    ],
  });
  const response = await graphqlRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({ "x-header-name": "aGVhZGVyLXZhbHVl" }),
  });
});
