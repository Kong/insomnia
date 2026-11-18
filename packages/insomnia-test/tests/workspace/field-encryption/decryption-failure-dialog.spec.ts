import { readRawDocs, updateDoc } from "@package/misc/db";
import { appendRawDoc, copyLegacyDatabase, encryptWithAnotherKey, LEGACY_WORKSPACE_ID } from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const UNDECRYPTABLE_A = encryptWithAnotherKey("password-of-a");
const UNDECRYPTABLE_B = encryptWithAnotherKey("token-of-b");

const test = base.extend({
  dataPath: async ({ dataPath }, use) => {
    copyLegacyDatabase(dataPath);
    const request = (id: string, name: string, authentication: Record<string, unknown>) =>
      appendRawDoc(dataPath, "Request", {
        _id: id,
        parentId: LEGACY_WORKSPACE_ID,
        name,
        url: `https://example.com/${id}`,
        authentication,
      });
    request("req_e2e_undecryptable_a", "Undecryptable A", {
      type: "basic",
      username: "user-a",
      password: UNDECRYPTABLE_A,
    });
    request("req_e2e_undecryptable_b", "Undecryptable B", { type: "bearer", token: UNDECRYPTABLE_B });
    request("req_e2e_healthy", "Healthy", { type: "bearer", token: "plaintext-of-the-healthy-request" });
    await use(dataPath);
  },
});

const rawRequest = (dataPath: string, id: string) => readRawDocs(dataPath, "Request").find((doc) => doc._id === id);

test("Dialog B: Reset affected fields clears only the fields that cannot be decrypted", async ({
  userAtStartup: user,
  dataPath,
}) => {
  const { appFlow } = user.flowManager;

  expect(await appFlow.waitForIssue()).toBe("decryptionFailed");
  expect(await appFlow.getAffectedFields()).toEqual(
    expect.arrayContaining([
      { label: "Undecryptable A", paths: ["authentication.password"] },
      { label: "Undecryptable B", paths: ["authentication.token"] },
    ]),
  );
  expect(await appFlow.getAffectedFields()).toHaveLength(2);
  expect(await appFlow.issueSurvivesEscapeAndOutsideClick()).toBe(true);

  await updateDoc(user.pageManager.window, "Request", "req_e2e_undecryptable_b", {
    authentication: { type: "bearer", token: "typed-by-the-user-meanwhile" },
  });

  await appFlow.resetAffectedFields();

  const [a] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_undecryptable_a" });
  expect(a.authentication.password ?? "").toBe("");
  expect(a.authentication).toMatchObject({ type: "basic", username: "user-a" });
  expect(a).toMatchObject({ name: "Undecryptable A", url: "https://example.com/req_e2e_undecryptable_a" });
  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password ?? "").not.toBe(UNDECRYPTABLE_A);

  const [b] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_undecryptable_b" });
  expect(b.authentication.token).toBe("typed-by-the-user-meanwhile");
  const [healthy] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_healthy" });
  expect(healthy.authentication.token).toBe("plaintext-of-the-healthy-request");

  await appFlow.restart();
  await appFlow.expectNoIssue();
});

test("Dialog B: Continue without decryption keeps the data and asks again on the next start", async ({
  userAtStartup: user,
  dataPath,
}) => {
  const { appFlow } = user.flowManager;

  expect(await appFlow.waitForIssue()).toBe("decryptionFailed");
  await appFlow.continueAnyway();

  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password).toBe(UNDECRYPTABLE_A);
  expect(rawRequest(dataPath, "req_e2e_undecryptable_b").authentication.token).toBe(UNDECRYPTABLE_B);

  await user.pageManager.window.reload();
  await user.pageManager.window.waitForLoadState();
  await appFlow.expectNoIssue();

  await appFlow.restart();
  expect(await appFlow.waitForIssue()).toBe("decryptionFailed");
  expect((await appFlow.getAffectedFields()).map((f) => f.label).sort()).toEqual([
    "Undecryptable A",
    "Undecryptable B",
  ]);
  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password).toBe(UNDECRYPTABLE_A);
});
