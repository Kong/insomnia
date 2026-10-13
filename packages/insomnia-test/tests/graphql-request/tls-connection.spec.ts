import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER_HTTPS, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify GraphQL Request Over a TLS Connection", async ({ user }) => {
  const { graphqlRequestFlow, preferencesFlow, workspaceFlow } =
    user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

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
    url: `${HTTP_SERVER_HTTPS}/post`,
    body,
  });
  const response = await graphqlRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  const sent = JSON.parse((response.body as { data: string }).data) as {
    query: string;
  };
  expect(sent.query.replace(/\s+/g, " ").trim()).toBe(query);
});
