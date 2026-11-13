import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

test("Bearer token is encrypted in insomnia.Request.db but shown as plaintext in the app", async ({
  user,
  dataPath,
}) => {
  const { request, token } = await createBearerRequest(user);

  await expect
    .poll(
      () =>
        readRawDocs(dataPath, "Request").find((doc) => doc.name === request.name)
          ?.authentication?.token,
    )
    .toMatch(ENCRYPTED_VALUE);
  expect(readRawDbText(dataPath)).not.toContain(token);

  await user.flowManager.appFlow.restart();

  const [doc] = await user.pageManager.findDocs("insomnia.Request.db", {
    name: request.name,
  });
  expect(doc.authentication.token).toBe(token);
  expect(readRawDbText(dataPath)).not.toContain(token);
});
