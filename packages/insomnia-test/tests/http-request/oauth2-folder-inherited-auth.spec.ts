import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { AuthType } from "@package/enums/auth-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Folder } from "@package/models/folder";
import { Project } from "@package/models/project";

test("Verify a request set to Inherit from parent picks up its folder's OAuth 2.0 authentication", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage, folderPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );

  await folderFlow.open(folder);
  await folderPage.auth.setOAuth2Fields({
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
  await httpRequestPage.auth.setAuthType(AuthType.Inherit);

  const responseView = await httpRequestFlow.send(request);
  const body = responseView.preview as { authorization?: string };

  expect(folderTokens.accessToken).not.toBe("");
  expect(responseView.statusBar.code).toBe(200);
  expect(body.authorization).toBe(`Bearer ${folderTokens.accessToken}`);
});
