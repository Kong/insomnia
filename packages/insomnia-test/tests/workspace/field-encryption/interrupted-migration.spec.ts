import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { appendRawDoc } from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

test("A file with both encrypted and plaintext values reads correctly and ends up fully encrypted on the next start", async ({
  user,
  dataPath,
}) => {
  const { appFlow } = user.flowManager;
  const { collection, request, token } = await createBearerRequest(user);
  await expect
    .poll(() => readRawDocs(dataPath, "Request").find((doc) => doc.name === request.name)?.authentication?.token)
    .toMatch(ENCRYPTED_VALUE);
  const encryptedByThisKey = readRawDocs(dataPath, "Request").find((doc) => doc.name === request.name).authentication
    .token as string;
  const [workspace] = await user.pageManager.findDocs("insomnia.Workspace.db", { name: collection.name });

  const plainToken = "plaintext-token-left-by-an-interrupted-migration";
  const plainPassword = "plaintext-password-left-by-an-interrupted-migration";
  const base = { type: "Request", parentId: workspace._id, url: "https://example.com" };
  // A document that was not reached yet: plaintext
  appendRawDoc(dataPath, "Request", {
    ...base,
    _id: "req_e2e_not_migrated",
    name: "Not migrated",
    authentication: { type: "bearer", token: plainToken },
  });
  // A document that was half done: one field already encrypted (with this installation's key), one not
  appendRawDoc(dataPath, "Request", {
    ...base,
    _id: "req_e2e_half_migrated",
    name: "Half migrated",
    authentication: {
      type: "oauth2",
      grantType: "client_credentials",
      clientId: "half-migrated-client",
      clientSecret: encryptedByThisKey,
      password: plainPassword,
    },
  });
  expect(readRawDbText(dataPath)).toContain(plainToken);

  const expectReadable = async (when: string) => {
    const find = async (query: Record<string, unknown>) =>
      (await user.pageManager.findDocs("insomnia.Request.db", query))[0];
    // Every document is there, and every value reads as plaintext
    expect((await find({ name: request.name })).authentication.token, `own request ${when}`).toBe(token);
    expect((await find({ _id: "req_e2e_not_migrated" })).authentication.token, `plaintext row ${when}`).toBe(plainToken);
    const half = (await find({ _id: "req_e2e_half_migrated" })).authentication;
    expect(half, `mixed row ${when}`).toMatchObject({
      clientId: "half-migrated-client",
      clientSecret: token,
      password: plainPassword,
    });
    await expect(
      user.pageManager.window
        .getByRole("dialog")
        .filter({ hasText: /could not be decrypted|encryption key is not available/ }),
      `no decryption dialog ${when}`,
    ).toHaveCount(0);
  };

  // The next start finishes the job
  await appFlow.restart();
  await expectReadable("after the next start");

  await expect
    .poll(() => {
      const docs = readRawDocs(dataPath, "Request");
      return [
        docs.find((d) => d._id === "req_e2e_not_migrated")?.authentication?.token,
        docs.find((d) => d._id === "req_e2e_half_migrated")?.authentication?.password,
        docs.find((d) => d._id === "req_e2e_half_migrated")?.authentication?.clientSecret,
      ].every((value) => typeof value === "string" && ENCRYPTED_VALUE.test(value));
    }, { message: "only encrypted values are left in the file" })
    .toBe(true);
  const text = readRawDbText(dataPath);
  expect(text).not.toContain(plainToken);
  expect(text).not.toContain(plainPassword);
  expect(text).not.toContain(token);
  // Nothing else changed
  expect(readRawDocs(dataPath, "Request").find((d) => d._id === "req_e2e_half_migrated")?.authentication).toMatchObject({
    clientId: "half-migrated-client",
  });

  // And it stays that way
  await appFlow.restart();
  await expectReadable("after another start");
});
