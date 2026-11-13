import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER } from "@package/misc/constants";
import { test } from "@package/misc/fixtures";
import type { HttpRequest } from "@package/models/http-request";
import { expect } from "@playwright/test";

import { createFixture, ECHO_URL, sendAndReadHeaders } from "./support";

const oauth2 = {
  grantType: "client_credentials",
  accessTokenUrl: `${OAUTH2_SERVER}/token`,
  clientId: OAUTH2_CLIENT_ID,
  clientSecret: OAUTH2_CLIENT_SECRET,
} as const;

test("Collection-level OAuth2 token is fetched and stored on the collection", async ({ user }) => {
  const { collectionFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { collection, folders, request: folderRequest } = await createFixture(user.flowManager, { folderDepth: 1 });
  const collectionRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: ECHO_URL,
  } as HttpRequest);

  await collectionFlow.setOAuth2(collection, oauth2);

  // 1. The request inherits the collection's OAuth2: its token is requested once, stored on the
  //    collection, and reused by the next send.
  const first = (await sendAndReadHeaders(user.flowManager, folderRequest)).authorization;
  expect(first).toMatch(/^Bearer access_/);
  const collectionTokens = await collectionFlow.getOAuth2Tokens(collection);
  expect(first).toBe(`Bearer ${collectionTokens.accessToken}`);
  expect((await sendAndReadHeaders(user.flowManager, folderRequest)).authorization).toBe(first);

  // 2. The folder defines its own OAuth2: requests in it use the folder's own token, which is stored on
  //    the folder, while the collection keeps its token for everything outside the folder.
  const folderPage = await folderFlow.open(folders[0]);
  await folderPage.auth.setOAuth2Fields(oauth2);

  const inFolder = (await sendAndReadHeaders(user.flowManager, folderRequest)).authorization;
  const folderTokens = await (await folderFlow.open(folders[0])).auth.getOAuth2Tokens();
  expect(inFolder).toBe(`Bearer ${folderTokens.accessToken}`);
  expect(inFolder).not.toBe(first);

  expect((await sendAndReadHeaders(user.flowManager, collectionRequest)).authorization).toBe(first);
  expect((await collectionFlow.getOAuth2Tokens(collection)).accessToken).toBe(collectionTokens.accessToken);
});
