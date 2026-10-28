import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

const sharedVariable = faker.string.alpha(8);
const subOnlyVariable = faker.string.alpha(9);

test("Verify a folder environment overrides sub and base environments for its requests while other variables fall through", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow, folderFlow, httpRequestFlow } =
    user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseShared = faker.string.alphanumeric(10);
  const baseSubOnly = faker.string.alphanumeric(10);
  const subShared = faker.string.alphanumeric(10);
  const subSubOnly = faker.string.alphanumeric(10);
  const folderShared = faker.string.alphanumeric(10);

  const baseEnvironment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      { id: "", name: sharedVariable, value: baseShared, type: EnvironmentKvPairDataType.STRING, enabled: true },
      { id: "", name: subOnlyVariable, value: baseSubOnly, type: EnvironmentKvPairDataType.STRING, enabled: true },
    ],
  });
  const subEnvironment = await environmentFlow.createSubEnvironment(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      { id: "", name: sharedVariable, value: subShared, type: EnvironmentKvPairDataType.STRING, enabled: true },
      { id: "", name: subOnlyVariable, value: subSubOnly, type: EnvironmentKvPairDataType.STRING, enabled: true },
    ],
  });
  await environmentFlow.link(collection, subEnvironment);

  const folder = await folderFlow.create(collection, new Folder(faker.string.alphanumeric(10)));
  await folderFlow.setEnvironmentVariables(folder, { [sharedVariable]: folderShared });

  const requestUrl = `${HTTP_SERVER}/post?shared={{ ${sharedVariable} }}&subOnly={{ ${subOnlyVariable} }}`;
  const requestInFolder = await httpRequestFlow.create(folder, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: requestUrl,
  });
  const requestOutsideFolder = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: requestUrl,
  });
  const responseInFolder = await httpRequestFlow.send(requestInFolder);
  const responseOutsideFolder = await httpRequestFlow.send(requestOutsideFolder);

  expect(responseInFolder.statusCode).toBe(200);
  expect(responseInFolder.body).toMatchObject({
    args: { shared: folderShared, subOnly: subSubOnly },
  });
  expect(responseOutsideFolder.statusCode).toBe(200);
  expect(responseOutsideFolder.body).toMatchObject({
    args: { shared: subShared, subOnly: subSubOnly },
  });
});
