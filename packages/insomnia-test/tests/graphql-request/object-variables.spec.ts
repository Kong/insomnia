import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

const url = `${HTTP_SERVER}/graphql`;
const query =
  "query Characters($filter: CharacterFilter) { characters(filter: $filter) { results { name status } } }";

test("Verify GraphQL Request With Object Variables", async ({ user }) => {
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
    url: url,
    body: {
      mimeType: ContentType.JSON,
      text: JSON.stringify({
        query,
        variables: { filter: { status: "Dead" } },
      }),
    },
  });
  const responseView = await graphqlRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    data: {
      characters: {
        results: [{ name: "Summer Smith", status: "Dead" }],
      },
    },
  });
});
