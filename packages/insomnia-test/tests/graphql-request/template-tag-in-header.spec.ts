import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify GraphQL Request Header With a Template Tag Is Resolved", async ({
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
  const responseView = await graphqlRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    headers: expect.objectContaining({ "x-header-name": "aGVhZGVyLXZhbHVl" }),
  });
});
