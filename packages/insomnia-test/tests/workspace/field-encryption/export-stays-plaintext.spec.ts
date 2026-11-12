import os from "node:os";
import path from "node:path";

import { ExportFormat } from "@package/enums/export-format";
import { waitForExportedFile } from "@package/misc/export-file";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// INS-2368 case 06 (export half): the exported file holds the real token, never ciphertext.
// The re-import half is not covered: the framework has no import Flow/Page yet.
test("Exported collection contains the plaintext token and no ciphertext", async ({
  user,
}) => {
  const { collection, token } = await createBearerRequest(user);
  const file = path.join(os.tmpdir(), `insomnia-test-export-${Date.now()}.yaml`);

  await user.flowManager.exportFlow.exportCollection(collection, ExportFormat.InsomniaV5, file);

  const exported = await waitForExportedFile(file);
  expect(exported).toContain(token);
  expect(exported).not.toContain("enc:insomnia:v1:");
});
