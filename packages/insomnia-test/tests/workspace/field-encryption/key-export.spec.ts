import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readRawDocs } from "@package/misc/db";
import { waitForExportedFile } from "@package/misc/export-file";
import { decryptStoredValue, keyBytesFromJwk } from "@package/misc/field-encryption-fixtures";
import { test } from "@package/misc/fixtures";
import { createBearerRequest } from "@package/tests/workspace/field-encryption/helpers";
import { expect } from "@playwright/test";

const storedToken = (dataPath: string, requestName: string): string =>
  readRawDocs(dataPath, "Request").find((doc) => doc.name === requestName).authentication.token;

test("Copy Key puts the key on the clipboard as one line of base64 after a confirmation", async ({
  user,
  dataPath,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { request, token } = await createBearerRequest(user);
  await expect.poll(() => storedToken(dataPath, request.name)).toMatch(/^enc:insomnia:v1:/);

  await preferencesFlow.openKeyPanel();
  expect(await preferencesFlow.areKeyButtonsEnabled()).toBe(true);

  await preferencesFlow.writeClipboard("clipboard before");
  await preferencesFlow.copyKey("cancel");
  expect(await preferencesFlow.readClipboard()).toBe("clipboard before");

  const { warning, buttonText } = await preferencesFlow.copyKey("continue");
  expect(warning).toContain("Keep this key private");
  expect(warning).toContain("use it only on this machine");
  expect(warning).toContain("Never use it on another machine");
  expect(buttonText).toContain("Copied");

  const clipboard = await preferencesFlow.readClipboard();
  expect(clipboard).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  const keyBytes = keyBytesFromJwk(Buffer.from(clipboard, "base64").toString("utf8"));
  expect(keyBytes).toHaveLength(32);
  expect(decryptStoredValue(keyBytes, storedToken(dataPath, request.name))).toBe(token);
});

test("Export Key saves insomnia-encryption-key.json with the key as a JWK, and cancelling saves nothing", async ({
  user,
  dataPath,
}) => {
  const { preferencesFlow } = user.flowManager;
  const { request, token } = await createBearerRequest(user);
  await expect.poll(() => storedToken(dataPath, request.name)).toMatch(/^enc:insomnia:v1:/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-key-export-"));
  const file = path.join(dir, "insomnia-encryption-key.json");

  try {
    await preferencesFlow.openKeyPanel();

    await preferencesFlow.exportKey("cancel", file);
    expect(fs.existsSync(file)).toBe(false);
    await preferencesFlow.exportKey("continue");
    expect(fs.existsSync(file)).toBe(false);
    expect(await preferencesFlow.hasErrorDialog()).toBe(false);

    const { warning, suggestedPath } = await preferencesFlow.exportKey("continue", file);
    expect(warning).toContain("Never use it on another machine");
    expect(path.basename(suggestedPath ?? "")).toBe("insomnia-encryption-key.json");

    const jwk = JSON.parse(await waitForExportedFile(file));
    expect(jwk).toMatchObject({ kty: "oct" });
    expect(typeof jwk.k).toBe("string");
    const modeMask: Record<string, number> = { win32: 0, darwin: 0o777, linux: 0o777 };
    const mode = fs.statSync(file).mode & 0o777 & modeMask[process.platform];
    expect(mode.toString(8), "exported key file permissions").toBe((0o600 & modeMask[process.platform]).toString(8));
    expect(
      decryptStoredValue(keyBytesFromJwk(JSON.stringify(jwk)), storedToken(dataPath, request.name)),
    ).toBe(token);
    expect(await preferencesFlow.hasErrorDialog()).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
