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

for (const pkceMethod of ["S256", "plain"] as const) {
  test(`Verify Authorization Code grant with PKCE (${pkceMethod}) is verified server-side and authorizes the sent request`, async ({
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
      grantType: "authorization_code",
      authorizationUrl: `${OAUTH2_SERVER}/authorize`,
      accessTokenUrl: `${OAUTH2_SERVER}/token`,
      clientId: OAUTH2_CLIENT_ID,
      clientSecret: OAUTH2_CLIENT_SECRET,
      redirectUrl: `${OAUTH2_SERVER}/health`,
      usePkce: true,
      pkceMethod,
    };
    const request = await httpRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${OAUTH2_SERVER}/resource`,
      authentication: authentication,
    });

    const tokens = await httpRequestFlow.fetchOAuth2Tokens(request);

    const lastTokenRequest = await (
      await fetch(
        `${OAUTH2_SERVER}/_debug/last-token-request?access_token=${encodeURIComponent(tokens.accessToken)}`,
      )
    ).json();

    const response = await httpRequestFlow.send(request);
    const body = response.body as { authorization?: string };

    expect(tokens.accessToken).not.toBe("");
    expect(lastTokenRequest.grantType).toBe("authorization_code");
    expect(lastTokenRequest.pkceUsed).toBe(true);
    expect(lastTokenRequest.pkceMethod).toBe(pkceMethod);
    expect(lastTokenRequest.pkceVerified).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(body.authorization).toBe(`Bearer ${tokens.accessToken}`);
  });
}
