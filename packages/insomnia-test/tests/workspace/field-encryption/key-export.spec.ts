import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readRawDocs } from "@package/misc/db";
import { waitForExportedFile } from "@package/misc/export-file";
import { decryptStoredValue, keyBytesFromJwk } from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// The key the buttons hand out must be the one that opens the database: decrypt the token a request stored on disk.
const storedToken = (dataPath: string, requestName: string): string =>
  readRawDocs(dataPath, "Request").find((doc) => doc.name === requestName).authentication.token;

// INS-2368 case 08
test("Copy Key puts the key on the clipboard as one line of base64 after a confirmation", async ({
  user,
  dataPath,
}) => {
  const { fieldEncryptionFlow } = user.flowManager;
  const { request, token } = await createBearerRequest(user);
  await expect.poll(() => storedToken(dataPath, request.name)).toMatch(/^enc:insomnia:v1:/);

  await fieldEncryptionFlow.openKeyPanel();
  expect(await fieldEncryptionFlow.areKeyButtonsEnabled()).toBe(true);

  // Cancel hands out nothing
  await fieldEncryptionFlow.writeClipboard("clipboard before");
  await fieldEncryptionFlow.copyKey("cancel");
  expect(await fieldEncryptionFlow.readClipboard()).toBe("clipboard before");

  const { warning, buttonText } = await fieldEncryptionFlow.copyKey("continue");
  expect(warning).toContain("Keep this key secure");
  expect(warning).toContain("use it on this machine only");
  expect(warning).toContain("Do not use it on any other machine");
  expect(buttonText).toContain("Copied");

  // One token, pasteable into a shell as it is: no quotes, no braces, no line breaks
  const clipboard = await fieldEncryptionFlow.readClipboard();
  expect(clipboard).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  const keyBytes = keyBytesFromJwk(Buffer.from(clipboard, "base64").toString("utf8"));
  expect(keyBytes).toHaveLength(32);
  expect(decryptStoredValue(keyBytes, storedToken(dataPath, request.name))).toBe(token);
});

// INS-2368 case 09
test("Export Key saves insomnia-encryption-key.json with the key as a JWK, and cancelling saves nothing", async ({
  user,
  dataPath,
}) => {
  const { fieldEncryptionFlow } = user.flowManager;
  const { request, token } = await createBearerRequest(user);
  await expect.poll(() => storedToken(dataPath, request.name)).toMatch(/^enc:insomnia:v1:/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-key-export-"));
  const file = path.join(dir, "insomnia-encryption-key.json");

  try {
    await fieldEncryptionFlow.openKeyPanel();

    // Cancelling the confirmation, or the save dialog, writes nothing and reports no error
    await fieldEncryptionFlow.exportKey("cancel", file);
    expect(fs.existsSync(file)).toBe(false);
    await fieldEncryptionFlow.exportKey("continue");
    expect(fs.existsSync(file)).toBe(false);
    expect(await fieldEncryptionFlow.hasErrorDialog()).toBe(false);

    const { warning, suggestedPath } = await fieldEncryptionFlow.exportKey("continue", file);
    expect(warning).toContain("only when you run the inso CLI on this machine");
    expect(path.basename(suggestedPath ?? "")).toBe("insomnia-encryption-key.json");

    const jwk = JSON.parse(await waitForExportedFile(file));
    expect(jwk).toMatchObject({ kty: "oct" });
    expect(typeof jwk.k).toBe("string");
    expect(
      decryptStoredValue(keyBytesFromJwk(JSON.stringify(jwk)), storedToken(dataPath, request.name)),
    ).toBe(token);
    expect(await fieldEncryptionFlow.hasErrorDialog()).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
