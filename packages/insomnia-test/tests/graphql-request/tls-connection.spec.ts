import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER_HTTPS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify GraphQL Request Over a TLS Connection", async ({ user }) => {
  const { graphqlRequestFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

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
    url: `${HTTP_SERVER_HTTPS}/post`,
    body,
  });
  const responseView = await graphqlRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  const sent = JSON.parse((responseView.preview as { data: string }).data) as {
    query: string;
  };
  expect(sent.query.replace(/\s+/g, " ").trim()).toBe(query);
});
