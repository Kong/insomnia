import { faker } from "@faker-js/faker";

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
import type { AuthTypeOAuth2 } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify refreshing an existing OAuth 2.0 token issues a new access token without reopening the authorization window", async ({
  user,
  insomnia,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const authentication: AuthTypeOAuth2 = {
    type: "oauth2",
    grantType: "authorization_code",
    authorizationUrl: `${OAUTH2_SERVER}/authorize`,
    accessTokenUrl: `${OAUTH2_SERVER}/token`,
    clientId: OAUTH2_CLIENT_ID,
    clientSecret: OAUTH2_CLIENT_SECRET,
    redirectUrl: `${OAUTH2_SERVER}/health`,
  };
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${OAUTH2_SERVER}/resource`,
    authentication: authentication,
  });

  const tokensAfterFetch = await httpRequestFlow.fetchOAuth2Tokens(request);

  const windowsBeforeRefresh = insomnia.windows().length;
  const tokensAfterRefresh = await httpRequestFlow.fetchOAuth2Tokens(request);
  const windowsAfterRefresh = insomnia.windows().length;

  const lastTokenRequest = await (
    await fetch(
      `${OAUTH2_SERVER}/_debug/last-token-request?access_token=${encodeURIComponent(tokensAfterRefresh.accessToken)}`,
    )
  ).json();

  expect(tokensAfterFetch.accessToken).not.toBe("");
  expect(windowsAfterRefresh).toBe(windowsBeforeRefresh);
  expect(lastTokenRequest.grantType).toBe("refresh_token");
  expect(tokensAfterRefresh.refreshToken).toBe(tokensAfterFetch.refreshToken);
  expect(tokensAfterRefresh.accessToken).not.toBe(tokensAfterFetch.accessToken);
});

test("Verify clearing OAuth 2.0 tokens wipes the stored Refresh/Identity/Access Token fields", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const authentication: AuthTypeOAuth2 = {
    type: "oauth2",
    grantType: "client_credentials",
    accessTokenUrl: `${OAUTH2_SERVER}/token`,
    clientId: OAUTH2_CLIENT_ID,
    clientSecret: OAUTH2_CLIENT_SECRET,
  };
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${OAUTH2_SERVER}/resource`,
    authentication: authentication,
  });

  const tokensAfterFetch = await httpRequestFlow.fetchOAuth2Tokens(request);

  await httpRequestPage.clearOAuth2Tokens();
  const tokensAfterClear = await httpRequestPage.getOAuth2Tokens();

  expect(tokensAfterFetch.accessToken).not.toBe("");
  expect(tokensAfterClear.accessToken).toBe("");
  expect(tokensAfterClear.refreshToken).toBe("");
  expect(tokensAfterClear.identityToken).toBe("");
});
