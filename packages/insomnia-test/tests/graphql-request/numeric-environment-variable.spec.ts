import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { EnvironmentKvPairDataType } from "@package/models/environment";
import { Project } from "@package/models/project";

const url = `${HTTP_SERVER}/graphql`;
const query = "query Ep($id: Int!) { episode(id: $id) { id name } }";

test("Verify GraphQL Request Renders a Numeric Environment Variable", async ({
  user,
}) => {
  const { environmentFlow, graphqlRequestFlow, workspaceFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const episodeId = faker.number.int({ min: 1, max: 3 });
  const variableName = faker.string.alpha(8);
  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: variableName,
        name: variableName,
        value: String(episodeId),
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const bodyText = `{"query": ${JSON.stringify(query)}, "variables": {"id": {{${variableName}}}} }`;
  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: url,
    body: { mimeType: ContentType.JSON, text: bodyText },
  });
  const responseView = await graphqlRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    data: { episode: { id: episodeId } },
  });
});
