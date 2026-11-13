import { readRawDocs, updateDoc } from "@package/misc/db";
import { appendRawDoc, copyLegacyDatabase, encryptWithAnotherKey, LEGACY_WORKSPACE_ID } from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

// A database restored without its key file: the app creates a new key, the two requests below hold values that an
// earlier key made and this one cannot open, and a third holds a plaintext secret the first launch encrypts as usual.
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
  const { fieldEncryptionFlow, appFlow } = user.flowManager;

  expect(await fieldEncryptionFlow.waitForIssue()).toBe("decryptionFailed");
  // The dialog names every affected document and field path, and cannot be dismissed from outside
  expect(await fieldEncryptionFlow.getAffectedFields()).toEqual(
    expect.arrayContaining([
      { label: "Undecryptable A", paths: ["authentication.password"] },
      { label: "Undecryptable B", paths: ["authentication.token"] },
    ]),
  );
  expect(await fieldEncryptionFlow.getAffectedFields()).toHaveLength(2);
  expect(await fieldEncryptionFlow.issueSurvivesEscapeAndOutsideClick()).toBe(true);

  // Before choosing, the user has typed a new token into one of the affected fields
  await updateDoc(user.pageManager.window, "Request", "req_e2e_undecryptable_b", {
    authentication: { type: "bearer", token: "typed-by-the-user-meanwhile" },
  });

  await fieldEncryptionFlow.resetAffectedFields();

  const [a] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_undecryptable_a" });
  expect(a.authentication.password ?? "").toBe("");
  // Everything else on the document is untouched
  expect(a.authentication).toMatchObject({ type: "basic", username: "user-a" });
  expect(a).toMatchObject({ name: "Undecryptable A", url: "https://example.com/req_e2e_undecryptable_a" });
  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password ?? "").not.toBe(UNDECRYPTABLE_A);

  // The value entered meanwhile survives, and so does the healthy request
  const [b] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_undecryptable_b" });
  expect(b.authentication.token).toBe("typed-by-the-user-meanwhile");
  const [healthy] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_e2e_healthy" });
  expect(healthy.authentication.token).toBe("plaintext-of-the-healthy-request");

  // Nothing is left to ask about
  await appFlow.restart();
  await fieldEncryptionFlow.expectNoIssue();
});

test("Dialog B: Continue without decryption keeps the data and asks again on the next start", async ({
  userAtStartup: user,
  dataPath,
}) => {
  const { fieldEncryptionFlow, appFlow } = user.flowManager;

  expect(await fieldEncryptionFlow.waitForIssue()).toBe("decryptionFailed");
  await fieldEncryptionFlow.continueAnyway();

  // Kept exactly as they were, ciphertext included
  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password).toBe(UNDECRYPTABLE_A);
  expect(rawRequest(dataPath, "req_e2e_undecryptable_b").authentication.token).toBe(UNDECRYPTABLE_B);

  // Not asked again during this run, not even after the window reloads
  await user.pageManager.window.reload();
  await user.pageManager.window.waitForLoadState();
  await fieldEncryptionFlow.expectNoIssue();

  // The problem is still there, so the next start asks again, about the same fields
  await appFlow.restart();
  expect(await fieldEncryptionFlow.waitForIssue()).toBe("decryptionFailed");
  expect((await fieldEncryptionFlow.getAffectedFields()).map((f) => f.label).sort()).toEqual([
    "Undecryptable A",
    "Undecryptable B",
  ]);
  expect(rawRequest(dataPath, "req_e2e_undecryptable_a").authentication.password).toBe(UNDECRYPTABLE_A);
});
