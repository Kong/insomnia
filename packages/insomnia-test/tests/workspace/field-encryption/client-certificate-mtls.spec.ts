import { createPrivateKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { HttpMethod } from "@package/enums/http-method";
import { CERT_DIR } from "@package/misc/certs";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { test } from "@package/misc/fixtures";
import { HttpRequest } from "@package/models/http-request";
import { Settings } from "@package/models/settings";
import { expect } from "@playwright/test";

import { createBearerRequest } from "./helpers";

// The mock server's mTLS endpoint (misc/server/mtls.ts): 401 without a client certificate, 200 with one.
const MTLS_HOST = "localhost:4011";
const MTLS_URL = `https://${MTLS_HOST}/protected/pets/1`;

test("Client certificate passphrase is encrypted on disk and mTLS still works, also after a restart", async ({
  user,
  dataPath,
}) => {
  const { certificatesFlow, httpRequestFlow, preferencesFlow, appFlow } = user.flowManager;
  const { collection } = await createBearerRequest(user);
  // A client key that needs a passphrase: the mock server's client key, protected
  const passphrase = `client-key-passphrase-${Date.now()}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-mtls-"));
  const certFile = path.join(dir, "client-cert.pem");
  fs.copyFileSync(path.join(CERT_DIR, "mtls-client-cert.pem"), certFile);
  const keyFile = path.join(dir, "client-key-protected.pem");
  fs.writeFileSync(
    keyFile,
    createPrivateKey(fs.readFileSync(path.join(CERT_DIR, "mtls-client-key.pem"))).export({
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase,
    }),
  );
  expect(fs.readFileSync(keyFile, "utf8")).toContain("ENCRYPTED PRIVATE KEY");

  try {
    // The mock server's certificate is signed by a CA of its own, which the app does not trust; and the app only
    // reads certificate files from folders it was told it may access
    await preferencesFlow.set(new Settings({ validateSSL: false, dataFolders: [dir] }));

    const request = await httpRequestFlow.create(
      collection,
      new HttpRequest({ name: "mtls", method: HttpMethod.Get, url: MTLS_URL }),
    );

    // Control: without the certificate the server turns the request down
    const rejected = await httpRequestFlow.send(request);
    expect(rejected.statusBar.code).toBe(401);

    await certificatesFlow.addClientCertificate(collection, {
      host: MTLS_HOST,
      cert: certFile,
      key: keyFile,
      passphrase,
    });

    // The passphrase and the files' paths are ciphertext in insomnia.ClientCertificate.db, readable nowhere else
    await expect
      .poll(() => readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === MTLS_HOST))
      .toBeTruthy();
    const stored = readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === MTLS_HOST);
    for (const field of ["passphrase", "cert", "key"]) {
      expect(stored[field], `${field} is encrypted`).toMatch(ENCRYPTED_VALUE);
    }
    expect(stored.host).toBe(MTLS_HOST);
    const text = readRawDbText(dataPath);
    expect(text).not.toContain(passphrase);
    expect(text).not.toContain(keyFile);

    // The handshake works: the passphrase was decrypted to open the key
    const accepted = await httpRequestFlow.send(request);
    expect(accepted.statusBar.code).toBe(200);
    expect(accepted.preview).toMatchObject({ id: "1" });

    // ... also after a restart
    await appFlow.restart();
    const [doc] = await user.pageManager.findDocs("insomnia.ClientCertificate.db", { host: MTLS_HOST });
    expect(doc.passphrase).toBe(passphrase);
    const afterRestart = await httpRequestFlow.send(request);
    expect(afterRestart.statusBar.code).toBe(200);
    expect(afterRestart.preview).toMatchObject({ id: "1" });
    expect(readRawDbText(dataPath)).not.toContain(passphrase);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
