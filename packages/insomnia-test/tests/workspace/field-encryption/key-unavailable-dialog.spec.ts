import fs from "node:fs";
import path from "node:path";

import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { keyFilePath, writeUnusableKeyFile } from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import { createBearerRequest } from "@package/tests/workspace/field-encryption/helpers";
import { expect } from "@playwright/test";

const rawToken = (dataPath: string, requestName: string): string | undefined =>
  readRawDocs(dataPath, "Request").find((doc) => doc.name === requestName)?.authentication?.token;

function breakKeyFile(dataPath: string): string {
  const working = fs.readFileSync(keyFilePath(dataPath), "utf8");
  writeUnusableKeyFile(dataPath);
  return working;
}

base("Dialog A: the missing key is reported once per run, deletes nothing, and the next start with a working key encrypts what was written meanwhile", async ({
  user,
  dataPath,
}) => {
  const { fieldEncryptionFlow, appFlow, httpRequestFlow } = user.flowManager;

  const { collection, request: first, token: firstToken } = await createBearerRequest(user);
  await expect.poll(() => rawToken(dataPath, first.name)).toMatch(ENCRYPTED_VALUE);
  const encryptedFirstToken = rawToken(dataPath, first.name);
  const workingKeyFile = breakKeyFile(dataPath);

  await appFlow.restart();
  expect(await fieldEncryptionFlow.waitForIssue()).toBe("degraded");
  expect(await fieldEncryptionFlow.issueSurvivesEscapeAndOutsideClick()).toBe(true);
  await fieldEncryptionFlow.continueAnyway();

  await user.pageManager.window.reload();
  await user.pageManager.window.waitForLoadState();
  await fieldEncryptionFlow.expectNoIssue();

  const [stored] = await user.pageManager.findDocs("insomnia.Request.db", { name: first.name });
  expect(stored.authentication.token).not.toBe(firstToken);
  expect(rawToken(dataPath, first.name)).toBe(encryptedFirstToken);

  const second = await httpRequestFlow.create(collection, {
    ...first,
    name: `${first.name}-degraded`,
    id: undefined,
    authentication: { type: "bearer", token: "token-entered-while-degraded" },
  });
  await expect.poll(() => rawToken(dataPath, second.name)).toBe("token-entered-while-degraded");

  fs.writeFileSync(keyFilePath(dataPath), workingKeyFile);
  await appFlow.restart();
  await fieldEncryptionFlow.expectNoIssue();
  await expect.poll(() => rawToken(dataPath, second.name)).toMatch(ENCRYPTED_VALUE);
  expect(readRawDbText(dataPath)).not.toContain("token-entered-while-degraded");
  const [reopened] = await user.pageManager.findDocs("insomnia.Request.db", { name: first.name });
  expect(reopened.authentication.token).toBe(firstToken);
  const [entered] = await user.pageManager.findDocs("insomnia.Request.db", { name: second.name });
  expect(entered.authentication.token).toBe("token-entered-while-degraded");
});

base("Dialog A: Reset local encryption key sets the old key aside and restarts with a new one", async ({
  user,
  dataPath,
}) => {
  const { fieldEncryptionFlow, appFlow } = user.flowManager;
  const { request } = await createBearerRequest(user);
  await expect.poll(() => rawToken(dataPath, request.name)).toMatch(ENCRYPTED_VALUE);
  breakKeyFile(dataPath);
  const unusableKey = fs.readFileSync(keyFilePath(dataPath), "utf8");
  const keyFiles = () => fs.readdirSync(path.dirname(keyFilePath(dataPath)));

  await appFlow.restart();
  expect(await fieldEncryptionFlow.waitForIssue()).toBe("degraded");
  expect(await fieldEncryptionFlow.canResetLocalKey()).toBe(true);

  const confirmation = await fieldEncryptionFlow.resetLocalKey(false);
  expect(confirmation.buttons).toEqual(["Cancel", "Reset Key and Restart"]);
  expect(confirmation.message).toContain("Reset the local encryption key");
  expect(fs.readFileSync(keyFilePath(dataPath), "utf8")).toBe(unusableKey);
  expect(keyFiles().filter((name) => name.includes(".bak"))).toEqual([]);
  expect(await fieldEncryptionFlow.waitForIssue()).toBe("degraded");

  await fieldEncryptionFlow.resetLocalKey(true);
  expect(fs.existsSync(keyFilePath(dataPath))).toBe(false);
  const backup = keyFiles().find((name) => name.startsWith("fieldEncryptionKey.bak-"));
  expect(backup, "the old key file is kept under a .bak name").toBeTruthy();
  expect(fs.readFileSync(path.join(path.dirname(keyFilePath(dataPath)), backup!), "utf8")).toBe(unusableKey);

  await appFlow.relaunch();
  expect(fs.existsSync(keyFilePath(dataPath))).toBe(true);
  expect(fs.readFileSync(keyFilePath(dataPath), "utf8")).not.toBe(unusableKey);
  expect(await fieldEncryptionFlow.waitForIssue()).toBe("decryptionFailed");
  expect(await fieldEncryptionFlow.getAffectedFields()).toEqual([
    { label: request.name, paths: ["authentication.token"] },
  ]);
});

const withoutKeyFile = base.extend({
  dataPath: async ({ dataPath }, use) => {
    const storage = path.join(dataPath, "localStorage");
    fs.mkdirSync(storage, { recursive: true });
    fs.chmodSync(storage, 0o555);
    await use(dataPath);
    fs.chmodSync(storage, 0o755);
  },
});

withoutKeyFile("Dialog A: no Reset button when there is no key file to set aside", async ({
  userAtStartup: user,
  dataPath,
}) => {
  const { fieldEncryptionFlow } = user.flowManager;

  expect(await fieldEncryptionFlow.waitForIssue()).toBe("degraded");
  expect(fs.existsSync(keyFilePath(dataPath))).toBe(false);
  expect(await fieldEncryptionFlow.canResetLocalKey()).toBe(false);
});

const withUnusableKey = base.extend({
  dataPath: async ({ dataPath }, use) => {
    writeUnusableKeyFile(dataPath);
    await use(dataPath);
  },
});

withUnusableKey("Local Encryption Key buttons are disabled when no key is loaded", async ({
  userAtStartup: user,
}) => {
  const { fieldEncryptionFlow } = user.flowManager;

  expect(await fieldEncryptionFlow.waitForIssue()).toBe("degraded");
  await fieldEncryptionFlow.continueAnyway();
  await fieldEncryptionFlow.openKeyPanel();

  expect(await fieldEncryptionFlow.areKeyButtonsEnabled()).toBe(false);
  expect(await fieldEncryptionFlow.getKeyUnavailableNotice()).toContain(
    "could not be loaded in this session",
  );
});
