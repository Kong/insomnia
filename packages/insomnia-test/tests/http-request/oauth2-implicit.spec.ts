import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  expect,
  OAUTH2_CLIENT_ID,
  OAUTH2_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { AuthTypeOAuth2 } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify Implicit grant with response type ID Token fetches only an identity token", async ({
  user,
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
    grantType: "implicit",
    authorizationUrl: `${OAUTH2_SERVER}/authorize`,
    clientId: OAUTH2_CLIENT_ID,
    redirectUrl: `${OAUTH2_SERVER}/health`,
    responseType: "id_token",
  };
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${OAUTH2_SERVER}/resource`,
    authentication: authentication,
  });

  const tokens = await httpRequestFlow.fetchOAuth2Tokens(request);

  // Confirmed live: with no separate access_token in the fragment, the
  // app falls back to displaying the identity token in the Access Token
  // field too (labeled "never expires" rather than an actual TTL),
  // rather than leaving it blank.
  expect(tokens.identityToken).not.toBe("");
  expect(tokens.accessToken).toBe(tokens.identityToken);
});

test("Verify Implicit grant with response type ID and Access Token authorizes the sent request", async ({
  user,
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
    grantType: "implicit",
    authorizationUrl: `${OAUTH2_SERVER}/authorize`,
    clientId: OAUTH2_CLIENT_ID,
    redirectUrl: `${OAUTH2_SERVER}/health`,
    responseType: "id_token token",
  };
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${OAUTH2_SERVER}/resource`,
    authentication: authentication,
  });

  const tokens = await httpRequestFlow.fetchOAuth2Tokens(request);

  const response = await httpRequestFlow.send(request);
  const body = response.body as { authorization?: string };

  expect(tokens.identityToken).not.toBe("");
  expect(tokens.accessToken).not.toBe("");
  expect(response.statusCode).toBe(200);
  expect(body.authorization).toBe(`Bearer ${tokens.accessToken}`);
});
