import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/graphql`;
const query = "{ characters { results { name } } }";

test("Verify GraphQL Schema Documentation Shows Field Descriptions", async ({
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
    url: url,
    body: { mimeType: ContentType.JSON, text: JSON.stringify({ query }) },
  });
  const responseView = await graphqlRequestFlow.send(request);

  expect(request.schema).toMatchObject({
    queryType: "Query",
    fields: expect.arrayContaining([
      expect.objectContaining({
        name: "characters",
        args: [{ name: "filter", type: "CharacterFilter" }],
        type: { name: "CharacterResults", isList: false, isNonNull: true },
      }),
      expect.objectContaining({
        name: "episode",
        args: [{ name: "id", type: "Int" }],
        type: { name: "Episode", isList: false, isNonNull: false },
      }),
    ]),
  });
  expect(responseView.statusCode).toBe(200);
  expect(responseView.body).toMatchObject({
    data: {
      characters: {
        results: expect.arrayContaining([
          expect.objectContaining({ name: "Rick Sanchez" }),
          expect.objectContaining({ name: "Morty Smith" }),
        ]),
      },
    },
  });
});
