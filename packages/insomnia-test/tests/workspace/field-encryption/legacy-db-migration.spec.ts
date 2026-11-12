import fs from "node:fs";
import path from "node:path";

import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { test as base } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

const LEGACY_DB = path.resolve(
  import.meta.dirname,
  "../../../../insomnia-smoke-test/fixtures/insomnia-legacy-db",
);
const WORKSPACE_ID = "wrk_1b49626a0a9442b7b9474a1f3493bb5d";
const TOKEN = "plaintext-bearer-token-from-before-the-upgrade";

// Seeds the plaintext legacy database (plus one request holding a bearer token) before Electron launches.
const test = base.extend({
  dataPath: async ({ dataPath }, use) => {
    fs.cpSync(LEGACY_DB, dataPath, { recursive: true });
    fs.appendFileSync(
      path.join(dataPath, "insomnia.Request.db"),
      `${JSON.stringify({
        _id: "req_plaintext_secret",
        type: "Request",
        parentId: WORKSPACE_ID,
        name: "Has a secret",
        url: "https://example.com",
        authentication: { type: "bearer", token: TOKEN },
      })}\n`,
    );
    await use(dataPath);
  },
});

// INS-2368 case 03 (Bearer token part): a plaintext database is migrated on first launch.
// The Cookie Jar value is not asserted here.
test("Plaintext legacy database is encrypted on first launch and keeps its documents", async ({
  user,
  dataPath,
}) => {
  const idsBefore = readRawDocs(LEGACY_DB, "Request").map((doc) => doc._id);

  await expect
    .poll(() => readRawDocs(dataPath, "Request").find((doc) => doc._id === "req_plaintext_secret")?.authentication?.token)
    .toMatch(ENCRYPTED_VALUE);
  expect(readRawDbText(dataPath)).not.toContain(TOKEN);
  expect(fs.existsSync(path.join(dataPath, "localStorage", "fieldEncryptionKey"))).toBe(true);

  const idsAfter = readRawDocs(dataPath, "Request").map((doc) => doc._id);
  expect(idsAfter).toEqual(expect.arrayContaining(idsBefore));

  const [doc] = await user.pageManager.findDocs("insomnia.Request.db", { _id: "req_plaintext_secret" });
  expect(doc.authentication.token).toBe(TOKEN);
});
