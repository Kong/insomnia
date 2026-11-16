import { CERT_DIR, certPath } from "@package/misc/certs";
import { MTLS_SERVER, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createCollection } from "./support";

test("Verify fetching a collection-level OAuth2 token from the Auth tab uses the collection's client certificate and CA", async ({ user }) => {
  test.fail(true, "INS-4318");
  const { collectionFlow, preferencesFlow } = user.flowManager;

  await preferencesFlow.set({ dataFolders: [CERT_DIR] });
  const collection = await createCollection(user.flowManager);

  await collectionFlow.addClientCertificate(collection, {
    host: "localhost:4011",
    cert: certPath("mtls-client-cert.pem"),
    key: certPath("mtls-client-key.pem"),
  });
  await collectionFlow.setCaCertificate(collection, certPath("mtls-ca.pem"));

  await collectionFlow.setOAuth2(collection, {
    grantType: "client_credentials",
    accessTokenUrl: `${MTLS_SERVER}/oauth/token`,
    clientId: OAUTH2_CLIENT_ID,
    clientSecret: OAUTH2_CLIENT_SECRET,
  });
  const tokens = await collectionFlow.fetchOAuth2Tokens(collection);

  expect(tokens.accessToken).toBe("mtls-access-token");
});
