import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const query = "{ characters { results { name } } }";
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test("Verify Generate Code Produces a cURL Snippet for GraphQL Request", async ({
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
  const url = `${HTTP_SERVER}/post`;
  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    body,
  });

  const code = await workspaceFlow.generateCode(request);

  expect(code).toContain("curl");
  expect(code).toContain("--request POST");
  expect(code).toContain(url);
  expect(code).toContain("characters");
});
