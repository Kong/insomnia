import fs from "node:fs";
import path from "node:path";

import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import {
  appendRawDoc,
  copyLegacyDatabase,
  keyFilePath,
  LEGACY_DB,
  LEGACY_WORKSPACE_ID,
} from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const TOKEN = "plaintext-bearer-token-from-before-the-upgrade";
const COOKIE_VALUE = "plaintext-cookie-value-from-before-the-upgrade";
const COOKIE_JAR_ID = "jar_477c547643674a53b75ec94371a59119";

// Seeds the plaintext legacy database before Electron launches: it holds almost no secrets of its own, so a request
// with a bearer token is added, and a cookie goes into the workspace's existing Cookie Jar (the app merges several
// jars of one workspace into one).
const test = base.extend({
  dataPath: async ({ dataPath }, use) => {
    copyLegacyDatabase(dataPath);
    appendRawDoc(dataPath, "Request", {
      _id: "req_plaintext_secret",
      parentId: LEGACY_WORKSPACE_ID,
      name: "Has a secret",
      url: "https://example.com",
      authentication: { type: "bearer", token: TOKEN },
    });
    const jarFile = path.join(dataPath, "insomnia.CookieJar.db");
    const jars = readRawDocs(dataPath, "CookieJar").map((jar) =>
      jar._id === COOKIE_JAR_ID
        ? { ...jar, cookies: [{ id: "1", key: "session", value: COOKIE_VALUE, domain: "example.com", path: "/" }] }
        : jar,
    );
    fs.writeFileSync(jarFile, `${jars.map((jar) => JSON.stringify(jar)).join("\n")}\n`);
    await use(dataPath);
  },
});

// Which models carry the user's own structure: projects, collections, folders, requests, environments
const STRUCTURE_MODELS = ["Project", "Workspace", "RequestGroup", "Request", "Environment"];

test("Plaintext legacy database is encrypted on first launch, and everything the user had is still there", async ({
  user,
  dataPath,
}) => {
  const { appFlow } = user.flowManager;
  // The key is created by this launch
  expect(fs.existsSync(keyFilePath(dataPath))).toBe(true);

  // Nothing tells the user about the migration: no dialog, no progress bar, no field-encryption notice
  const page = user.pageManager.window;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByTestId("field-encryption-issue-modal")).toHaveCount(0);

  const expectMigrated = async () => {
    // The secrets are ciphertext on disk, and no plaintext of them is left in any .db file
    await expect
      .poll(() => readRawDocs(dataPath, "Request").find((doc) => doc._id === "req_plaintext_secret")?.authentication?.token)
      .toMatch(ENCRYPTED_VALUE);
    const jar = readRawDocs(dataPath, "CookieJar").find((doc) => doc._id === COOKIE_JAR_ID);
    expect(jar.cookies[0].value).toMatch(ENCRYPTED_VALUE);
    expect(jar.cookies[0]).toMatchObject({ key: "session", domain: "example.com", path: "/" });
    const text = readRawDbText(dataPath);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(COOKIE_VALUE);

    // What the app holds is the plaintext again
    const [request] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_plaintext_secret" });
    expect(request.authentication.token).toBe(TOKEN);
    const [appJar] = await user.pageManager.findDocs("insomnia.CookieJar.db", { _id: COOKIE_JAR_ID });
    expect(appJar.cookies[0].value).toBe(COOKIE_VALUE);
  };

  // Every project, collection, folder, request and environment of the old data is there with the same id and name
  for (const model of STRUCTURE_MODELS) {
    const before = readRawDocs(LEGACY_DB, model);
    const after = await user.pageManager.findDocs(`insomnia.${model}.db`);
    for (const doc of before) {
      const now = after.find((d) => d._id === doc._id);
      expect(now, `${model} ${doc._id} is still there`).toBeTruthy();
      expect(now.name, `${model} ${doc._id} keeps its name`).toBe(doc.name);
    }
  }

  await expectMigrated();
  // ... and stays so after a restart
  await appFlow.restart();
  await expectMigrated();
});
