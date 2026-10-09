import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { AuthTypeOAuth1 } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify OAuth 1.0 auth fields persist and sign the sent request", async ({
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

  const authentication: AuthTypeOAuth1 = {
    type: "oauth1",
    consumerKey: faker.string.alphanumeric(10),
    consumerSecret: faker.string.alphanumeric(10),
    tokenKey: faker.string.alphanumeric(10),
    tokenSecret: faker.string.alphanumeric(10),
    signatureMethod: "HMAC-SHA256",
    callback: "https://example.com/callback",
    version: "1.0",
    realm: faker.string.alphanumeric(8),
  };
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    authentication: authentication,
  });

  const response = await httpRequestFlow.send(request);
  const authHeader = (response.body as { headers: Record<string, string> })
    .headers.authorization;

  expect(response.statusCode).toBe(200);
  expect(authHeader).toContain("OAuth ");
  expect(authHeader).toContain(
    `oauth_consumer_key="${authentication.consumerKey}"`,
  );
  expect(authHeader).toContain(`oauth_token="${authentication.tokenKey}"`);
  expect(authHeader).toContain(
    `oauth_signature_method="${authentication.signatureMethod}"`,
  );
  expect(authHeader).toContain(`oauth_version="${authentication.version}"`);
});
