import fs from "node:fs";

import { readRawDocs } from "@package/misc/db";
import {
  appendRawDoc,
  copyDataDir,
  randomJwkKey,
  snapshotDataDir,
} from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBasicAuthCollection } from "./helpers";

test("inso with a key that is not the app's fails without encrypting the plaintext values left in the data", async ({
  user,
  dataPath,
}) => {
  test.fail(true, "INS-4333");
  const { insoFlow } = user.flowManager;
  const { workspaceId } = await createBasicAuthCollection(user, dataPath);

  const plainToken = "plaintext-token-left-in-the-data-directory";
  const workingDir = copyDataDir(dataPath);
  try {
    appendRawDoc(workingDir, "Request", {
      _id: "req_e2e_left_in_plaintext",
      parentId: workspaceId,
      name: "Left in plaintext",
      url: "https://example.com",
      authentication: { type: "bearer", token: plainToken },
    });
    const before = snapshotDataDir(workingDir);

    const result = await insoFlow.runCollection({
      workingDir,
      workspaceId,
      encryptionKeyOption: randomJwkKey(),
    });

    expect(result.exitCode, "a key that does not open the data is an error").not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Could not decrypt \d+ encrypted value/);
    expect(result.statusCodes, "nothing is sent").toEqual([]);

    const left = readRawDocs(workingDir, "Request").find((doc) => doc._id === "req_e2e_left_in_plaintext");
    expect(
      left.authentication.token,
      "the value was not encrypted with a key that its Insomnia does not have",
    ).toBe(plainToken);
    expect(JSON.stringify(snapshotDataDir(workingDir)), "no data is changed").toBe(JSON.stringify(before));
  } finally {
    fs.rmSync(workingDir, { recursive: true, force: true });
  }
});
