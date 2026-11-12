import path from "node:path";
import { gunzipSync } from "node:zlib";

import { CERT_DIR } from "@package/misc/certs";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { test } from "@package/misc/fixtures";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// INS-2368 case 05, the parts that can be created through the UI rather than seeded:
// the request history snapshot written by a real send, and a client certificate added in Manage Certificates
// (the UI keeps the chosen files' paths in `cert` / `key`).

test("RequestVersion: the history snapshot of a sent request is encrypted but still contains the request", async ({
  user,
  dataPath,
}) => {
  const { request, token } = await createBearerRequest(user);
  await user.flowManager.httpRequestFlow.send(request);

  await expect
    .poll(() => readRawDocs(dataPath, "RequestVersion").length, { message: "a RequestVersion is written" })
    .toBeGreaterThan(0);
  for (const version of readRawDocs(dataPath, "RequestVersion")) {
    expect(version.compressedRequest).toMatch(ENCRYPTED_VALUE);
  }
  expect(readRawDbText(dataPath)).not.toContain(token);

  // The snapshot is gzip + base64 of the whole request: the app still restores the token from it
  const versions = await user.pageManager.findDocs("insomnia.RequestVersion.db");
  const restored = versions.map((v) => gunzipSync(Buffer.from(v.compressedRequest, "base64")).toString("utf8"));
  expect(restored.some((json) => json.includes(token))).toBe(true);
});

test("ClientCertificate added in Manage Certificates: passphrase, cert and key are encrypted", async ({
  user,
  dataPath,
}) => {
  const { collection } = await createBearerRequest(user);
  const certFile = path.join(CERT_DIR, "mtls-client-cert.pem");
  const keyFile = path.join(CERT_DIR, "mtls-client-key.pem");
  const passphrase = `passphrase-${Date.now()}-e2e-secret`;
  const host = "mtls.example.com";

  await user.flowManager.certificatesFlow.addClientCertificate(collection, {
    host,
    cert: certFile,
    key: keyFile,
    passphrase,
  });

  await expect
    .poll(() => readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === host))
    .toBeTruthy();
  const stored = readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === host);
  expect(stored.host).toBe(host);
  for (const field of ["passphrase", "cert", "key"]) {
    expect(stored[field], `${field} is encrypted`).toMatch(ENCRYPTED_VALUE);
  }

  // The UI stores the picked files' paths in `cert` / `key`; those are encrypted too, so no .db file names them
  const text = readRawDbText(dataPath);
  expect(text).not.toContain(passphrase);
  expect(text).not.toContain(certFile);
  expect(text).not.toContain(keyFile);

  // The app still holds the plaintext, also after a restart
  await user.flowManager.appFlow.restart();
  const [doc] = await user.pageManager.findDocs("insomnia.ClientCertificate.db", { host });
  expect(doc.passphrase).toBe(passphrase);
  expect(doc.cert).toBe(certFile);
  expect(doc.key).toBe(keyFile);
});
