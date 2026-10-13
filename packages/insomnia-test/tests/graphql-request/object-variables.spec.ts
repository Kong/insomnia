import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/graphql`;
const query =
  "query Characters($filter: CharacterFilter) { characters(filter: $filter) { results { name status } } }";

test("Verify GraphQL Request With Object Variables", async ({ user }) => {
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
    url: url,
    body: {
      mimeType: ContentType.JSON,
      text: JSON.stringify({
        query,
        variables: { filter: { status: "Dead" } },
      }),
    },
  });
  const response = await graphqlRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    data: {
      characters: {
        results: [{ name: "Summer Smith", status: "Dead" }],
      },
    },
  });
});
