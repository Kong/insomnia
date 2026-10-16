// Generates the TLS/mTLS fixtures the mock servers and specs use, so no
// private key has to be committed. Output goes to misc/fixtures/generated/
// (git-ignored). Idempotent: does nothing when every file already exists, so
// playwright.config.ts can call it once before the webServers start and each
// server can call it again as a no-op (or to run standalone).
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const forge = require("node-forge");

const CERT_DIR = path.join(__dirname, "fixtures", "generated");

const FILES = [
  "localhost-key.pem",
  "localhost-cert.pem",
  "mtls-ca.pem",
  "mtls-server-key.pem",
  "mtls-server-cert.pem",
  "mtls-client-key.pem",
  "mtls-client-cert.pem",
];

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function generateKeyPair() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const forgePrivate = forge.pki.privateKeyFromPem(privatePem);
  const forgePublic = forge.pki.setRsaPublicKey(forgePrivate.n, forgePrivate.e);
  return { privatePem, forgePrivate, forgePublic };
}

function createCert({ commonName, issuer, issuerKey, key, extensions }) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = key.forgePublic;
  cert.serialNumber = crypto.randomBytes(8).toString("hex");
  // Back-date the start so a clock a little behind this machine's still accepts it.
  cert.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + TEN_YEARS_MS);
  const subject = [{ name: "commonName", value: commonName }];
  cert.setSubject(subject);
  cert.setIssuer(issuer ?? subject);
  cert.setExtensions(extensions);
  cert.sign(issuerKey ?? key.forgePrivate, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

const LOCALHOST_SAN = {
  name: "subjectAltName",
  altNames: [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
  ],
};

function generate() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const write = (name, contents) =>
    fs.writeFileSync(path.join(CERT_DIR, name), contents);

  // Self-signed localhost cert, used by every plain HTTPS/WSS/gRPC-TLS server.
  const localhostKey = generateKeyPair();
  write("localhost-key.pem", localhostKey.privatePem);
  write(
    "localhost-cert.pem",
    createCert({
      commonName: "localhost",
      key: localhostKey,
      extensions: [LOCALHOST_SAN],
    }),
  );

  // CA that signs the mTLS server and client certs. Its private key is only
  // needed to sign them, so it's never written to disk.
  const caKey = generateKeyPair();
  const caName = [{ name: "commonName", value: "Insomnia Test mTLS CA" }];
  const caPem = createCert({
    commonName: "Insomnia Test mTLS CA",
    key: caKey,
    extensions: [
      { name: "basicConstraints", cA: true },
      { name: "keyUsage", keyCertSign: true, cRLSign: true },
    ],
  });
  write("mtls-ca.pem", caPem);

  const serverKey = generateKeyPair();
  write("mtls-server-key.pem", serverKey.privatePem);
  write(
    "mtls-server-cert.pem",
    createCert({
      commonName: "localhost",
      issuer: caName,
      issuerKey: caKey.forgePrivate,
      key: serverKey,
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "extKeyUsage", serverAuth: true },
        LOCALHOST_SAN,
      ],
    }),
  );

  const clientKey = generateKeyPair();
  write("mtls-client-key.pem", clientKey.privatePem);
  write(
    "mtls-client-cert.pem",
    createCert({
      commonName: "insomnia-test-client",
      issuer: caName,
      issuerKey: caKey.forgePrivate,
      key: clientKey,
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "extKeyUsage", clientAuth: true },
      ],
    }),
  );
}

/**
 * Generates the fixtures when any is missing.
 * @returns The directory the PEM files live in
 */
function ensureCerts() {
  const complete = FILES.every((name) =>
    fs.existsSync(path.join(CERT_DIR, name)),
  );
  if (!complete) generate();
  return CERT_DIR;
}

/**
 * @param name - A fixture file name, e.g. `"localhost-key.pem"`
 * @returns The absolute path to that generated file, creating it first if needed
 */
function certPath(name) {
  ensureCerts();
  return path.join(CERT_DIR, name);
}

module.exports = { CERT_DIR, ensureCerts, certPath };
