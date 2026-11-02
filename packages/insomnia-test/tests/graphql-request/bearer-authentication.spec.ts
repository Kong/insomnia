import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify GraphQL Request Sends the Bearer Token Header Until Authentication Is Set to None", async ({
  user,
}) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const token = faker.string.alphanumeric(20);
  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body,
    authentication: { type: "bearer", token },
  });
  const authenticatedResponse = await graphqlRequestFlow.send(request);
  await graphqlRequestFlow.setAuthentication(request, { type: "none" });
  const unauthenticatedResponse = await graphqlRequestFlow.send(request);

  expect(authenticatedResponse.statusBar.code).toBe(200);
  expect(authenticatedResponse.preview).toMatchObject({
    headers: expect.objectContaining({ authorization: `Bearer ${token}` }),
  });
  expect(unauthenticatedResponse.statusBar.code).toBe(200);
  expect(
    (unauthenticatedResponse.preview as { headers: Record<string, string> })
      .headers,
  ).not.toHaveProperty("authorization");
});
