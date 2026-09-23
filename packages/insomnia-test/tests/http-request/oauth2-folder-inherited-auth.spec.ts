import { faker } from "@faker-js/faker";

import { AuthType } from "../../enums/auth-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  expect,
  OAUTH2_CLIENT_ID,
  OAUTH2_CLIENT_SECRET,
  OAUTH2_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify a request set to Inherit from parent picks up its folder's OAuth 2.0 authentication", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage, folderPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );

  await folderFlow.open(folder);
  await folderPage.setOAuth2Fields({
    type: "oauth2",
    grantType: "client_credentials",
    accessTokenUrl: `${OAUTH2_SERVER}/token`,
    clientId: OAUTH2_CLIENT_ID,
    clientSecret: OAUTH2_CLIENT_SECRET,
  });
  const folderTokens = await folderFlow.fetchOAuth2Tokens(folder);

  const request = await httpRequestFlow.create(folder, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${OAUTH2_SERVER}/resource`,
  });
  await httpRequestPage.setAuthType(AuthType.Inherit);

  const response = await httpRequestFlow.send(request);
  const body = response.body as { authorization?: string };

  expect(folderTokens.accessToken).not.toBe("");
  expect(response.statusCode).toBe(200);
  expect(body.authorization).toBe(`Bearer ${folderTokens.accessToken}`);
});
