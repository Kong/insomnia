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

test("Verify Client Credentials grant fetches tokens with no popup and authorizes the sent request", async ({
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

  const windowsBeforeFetch = insomnia.windows().length;
  const tokens = await httpRequestFlow.fetchOAuth2Tokens(request);
  const windowsAfterFetch = insomnia.windows().length;

  const lastTokenRequest = await (
    await fetch(
      `${OAUTH2_SERVER}/_debug/last-token-request?access_token=${encodeURIComponent(tokens.accessToken)}`,
    )
  ).json();

  const response = await httpRequestFlow.send(request);
  const body = response.body as { authorization?: string };

  expect(tokens.accessToken).not.toBe("");
  expect(windowsAfterFetch).toBe(windowsBeforeFetch);
  expect(lastTokenRequest.grantType).toBe("client_credentials");
  expect(response.statusCode).toBe(200);
  expect(body.authorization).toBe(`Bearer ${tokens.accessToken}`);
});
