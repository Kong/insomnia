import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify Linked Cookie Is Sent With GraphQL Request", async ({ user }) => {
  const { cookieFlow, graphqlRequestFlow, workspaceFlow } = user.flowManager;

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
  });

  const cookieKey = faker.string.alphanumeric(8);
  const cookieValue = faker.string.alphanumeric(8);
  await cookieFlow.link(request, [
    { key: cookieKey, value: cookieValue, domain: "localhost", path: "/" },
  ]);

  const response = await graphqlRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      cookie: `${cookieKey}=${cookieValue}`,
    }),
  });
});
