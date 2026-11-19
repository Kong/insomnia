import path from "node:path";

import { faker } from "@faker-js/faker";
import { HttpMethod } from "@package/enums/http-method";
import { FlowManager } from "@package/flows/flow-manager";
import { CERT_DIR } from "@package/misc/certs";
import { ACTION_TIMEOUT, HTTP_SERVER } from "@package/misc/constants";
import { createDoc, ENCRYPTED_VALUE, readRawDbText, readRawDocs, updateDoc } from "@package/misc/db";
import type { UserSession } from "@package/misc/fixtures";
import { test as base } from "@package/misc/fixtures";
import { launchInsomniaElectron } from "@package/misc/launch";
import { SessionContext } from "@package/misc/session-context";
import { PageManager } from "@package/pages/page-manager";
import { expect } from "@playwright/test";

const SCRATCH_PAD_WORKSPACE_ID = "wrk_scratchpad";

const test = base.extend<{ loggedOutUser: UserSession }>({
  loggedOutUser: async ({ dataPath }, use) => {
    const config = { dataPath, skipOnboarding: true, vaultKey: "", vaultSalt: "" };
    const app = await launchInsomniaElectron({ ...config, extraEnv: { INSOMNIA_SESSION: "" } });
    const page = await app.firstWindow();
    await page.waitForLoadState();
    page.setDefaultTimeout(ACTION_TIMEOUT);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) => window.isVisible())
        ?.maximize();
    });
    const pageManager = new PageManager(page);
    const flowManager = new FlowManager(pageManager, new SessionContext(app, config));
    await use({ page, pageManager, flowManager });
    await app.close();
  },
});

const secret = (scope: string, field: string): string => `secret-${scope}-${field}-${faker.string.alphanumeric(10)}`;

const valueAt = (doc: any, field: string): unknown => field.split(".").reduce((value, key) => value?.[key], doc);

test("Data saved in the Scratch Pad while logged out is encrypted on disk, whatever the field type", async ({
  loggedOutUser,
  dataPath,
}) => {
  const { workspaceFlow, httpRequestFlow, cookieFlow, certificatesFlow } = loggedOutUser.flowManager;

  const collection = await workspaceFlow.openScratchPad();

  const passphrase = secret("certificate", "passphrase");
  const host = `${faker.string.alphanumeric(8).toLowerCase()}.example.com`;
  const cookie = {
    key: "session",
    value: secret("cookie", "value"),
    domain: "example.com",
    path: "/",
  };
  const uiRequests = [
    {
      name: faker.string.alphanumeric(10),
      authentication: { type: "basic" as const, username: "basic-user", password: secret("basic", "password") },
      encrypted: ["password"],
      plain: ["username"],
    },
    {
      name: faker.string.alphanumeric(10),
      authentication: { type: "bearer" as const, token: secret("bearer", "token") },
      encrypted: ["token"],
      plain: [],
    },
    {
      name: faker.string.alphanumeric(10),
      authentication: {
        type: "apikey" as const,
        key: secret("apikey", "key"),
        value: secret("apikey", "value"),
        addTo: "header" as const,
      },
      encrypted: ["key", "value"],
      plain: [],
    },
    {
      name: faker.string.alphanumeric(10),
      authentication: {
        type: "oauth2" as const,
        grantType: "password" as const,
        clientId: "oauth2-client-id",
        clientSecret: secret("oauth2", "clientSecret"),
        username: "oauth2-user",
        password: secret("oauth2", "password"),
      },
      encrypted: ["clientSecret", "password"],
      plain: ["clientId", "username", "grantType"],
    },
    {
      name: faker.string.alphanumeric(10),
      authentication: {
        type: "oauth1" as const,
        consumerKey: "oauth1-consumer-key",
        consumerSecret: secret("oauth1", "consumerSecret"),
        tokenKey: "oauth1-token-key",
        tokenSecret: secret("oauth1", "tokenSecret"),
      },
      encrypted: ["consumerSecret", "tokenSecret"],
      plain: ["consumerKey", "tokenKey"],
    },
  ];
  const requests = [];
  for (const { name, authentication } of uiRequests) {
    requests.push(
      await httpRequestFlow.create(collection, {
        name,
        method: HttpMethod.Get,
        url: `${HTTP_SERVER}/get`,
        authentication,
      }),
    );
  }
  await httpRequestFlow.send(requests[1]);
  await cookieFlow.link(collection, [cookie]);
  await certificatesFlow.addClientCertificate(collection, {
    host,
    cert: path.join(CERT_DIR, "mtls-client-cert.pem"),
    key: path.join(CERT_DIR, "mtls-client-key.pem"),
    passphrase,
  });

  const basicAuth = (scope: string) => ({
    type: "basic",
    username: `${scope}-user`,
    password: secret(scope, "password"),
  });
  const seeded: { type: string; doc: Record<string, any>; encrypted: string[]; update?: boolean }[] = [
    {
      type: "Request",
      doc: {
        _id: "req_e2e_digest",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "digest",
        authentication: { type: "digest", username: "digest-user", password: secret("digest", "password") },
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "Request",
      doc: {
        _id: "req_e2e_singletoken",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "singletoken",
        authentication: { type: "singleToken", token: secret("singletoken", "token") },
      },
      encrypted: ["authentication.token"],
    },
    {
      type: "Request",
      doc: {
        _id: "req_e2e_ntlm",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "ntlm",
        authentication: { type: "ntlm", username: "ntlm-user", password: secret("ntlm", "password") },
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "Request",
      doc: {
        _id: "req_e2e_hawk",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "hawk",
        authentication: { type: "hawk", id: "hawk-id", key: secret("hawk", "key"), algorithm: "sha256" },
      },
      encrypted: ["authentication.key"],
    },
    {
      type: "Request",
      doc: {
        _id: "req_e2e_iam",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "iam",
        authentication: {
          type: "iam",
          accessKeyId: secret("iam", "accessKeyId"),
          secretAccessKey: secret("iam", "secretAccessKey"),
          sessionToken: secret("iam", "sessionToken"),
        },
      },
      encrypted: ["authentication.accessKeyId", "authentication.secretAccessKey", "authentication.sessionToken"],
    },
    {
      type: "Request",
      doc: {
        _id: "req_e2e_asap",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "asap",
        authentication: { type: "asap", issuer: "asap-issuer", privateKey: secret("asap", "privateKey") },
      },
      encrypted: ["authentication.privateKey"],
    },
    {
      type: "Workspace",
      update: true,
      doc: { _id: SCRATCH_PAD_WORKSPACE_ID, authentication: basicAuth("workspace") },
      encrypted: ["authentication.password"],
    },
    {
      type: "RequestGroup",
      doc: {
        _id: "fld_e2e_auth",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "folder",
        authentication: basicAuth("folder"),
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "WebSocketRequest",
      doc: {
        _id: "ws-req_e2e_auth",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "websocket",
        url: "ws://localhost",
        authentication: basicAuth("websocket"),
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "SocketIORequest",
      doc: {
        _id: "socketio-req_e2e_auth",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "socketio",
        url: "http://localhost",
        authentication: basicAuth("socketio"),
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "McpRequest",
      doc: {
        _id: "mcp-req_e2e_auth",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "mcp",
        url: "http://localhost",
        authentication: basicAuth("mcp"),
      },
      encrypted: ["authentication.password"],
    },
    {
      type: "GrpcRequest",
      doc: {
        _id: "greq_e2e_reflection",
        parentId: SCRATCH_PAD_WORKSPACE_ID,
        name: "grpc",
        url: "localhost:50051",
        reflectionApi: {
          enabled: true,
          url: "https://buf.build",
          apiKey: secret("grpc", "apiKey"),
          module: "buf.build/acme/pets",
        },
      },
      encrypted: ["reflectionApi.apiKey"],
    },
  ];
  for (const { type, doc } of seeded.filter(({ update }) => !update)) {
    await createDoc(loggedOutUser.page, type, doc);
  }
  for (const { type, doc } of seeded.filter(({ update }) => update)) {
    await updateDoc(loggedOutUser.page, type, doc._id, doc);
  }

  const secrets = [
    ...uiRequests.flatMap(({ authentication, encrypted }) =>
      encrypted.map((field) => valueAt(authentication, field) as string),
    ),
    cookie.value,
    passphrase,
    ...seeded.flatMap(({ doc, encrypted }) => encrypted.map((field) => valueAt(doc, field) as string)),
  ];

  for (const { name, authentication, encrypted, plain } of uiRequests) {
    for (const field of encrypted) {
      await expect
        .poll(() => readRawDocs(dataPath, "Request").find((doc) => doc.name === name)?.authentication?.[field], {
          message: `Request "${name}": authentication.${field} is encrypted`,
        })
        .toMatch(ENCRYPTED_VALUE);
    }
    const stored = readRawDocs(dataPath, "Request").find((doc) => doc.name === name);
    expect(stored.parentId).toBe(SCRATCH_PAD_WORKSPACE_ID);
    expect(stored.authentication.type).toBe(authentication.type);
    for (const field of plain) {
      expect(stored.authentication[field], `Request "${name}": authentication.${field}`).toBe(
        valueAt(authentication, field) as string,
      );
    }
    const [inApp] = await loggedOutUser.pageManager.findDocs("insomnia.Request.db", { name });
    for (const field of encrypted) {
      expect(inApp.authentication[field], `Request "${name}": authentication.${field} in the app`).toBe(
        valueAt(authentication, field) as string,
      );
    }
  }

  await expect
    .poll(() => readRawDocs(dataPath, "CookieJar").find((jar) => jar.parentId === SCRATCH_PAD_WORKSPACE_ID)?.cookies)
    .toEqual(expect.arrayContaining([expect.objectContaining({ key: cookie.key, domain: cookie.domain })]));
  const storedCookie = readRawDocs(dataPath, "CookieJar")
    .find((jar) => jar.parentId === SCRATCH_PAD_WORKSPACE_ID)
    .cookies.find((c: any) => c.key === cookie.key);
  expect(storedCookie.value).toMatch(ENCRYPTED_VALUE);
  const [jar] = await loggedOutUser.pageManager.findDocs("insomnia.CookieJar.db", {
    parentId: SCRATCH_PAD_WORKSPACE_ID,
  });
  expect(jar.cookies.find((c: any) => c.key === cookie.key).value).toBe(cookie.value);

  await expect.poll(() => readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === host)).toBeTruthy();
  const storedCertificate = readRawDocs(dataPath, "ClientCertificate").find((c) => c.host === host);
  expect(storedCertificate.parentId).toBe(SCRATCH_PAD_WORKSPACE_ID);
  for (const field of ["passphrase", "cert", "key"]) {
    expect(storedCertificate[field], `ClientCertificate: ${field} is encrypted`).toMatch(ENCRYPTED_VALUE);
  }

  await expect
    .poll(() => readRawDocs(dataPath, "RequestVersion").length, { message: "a RequestVersion is written" })
    .toBeGreaterThan(0);
  for (const version of readRawDocs(dataPath, "RequestVersion")) {
    expect(version.compressedRequest).toMatch(ENCRYPTED_VALUE);
  }

  for (const { type, doc, encrypted } of seeded) {
    await expect
      .poll(() => readRawDocs(dataPath, type).find((stored) => stored._id === doc._id), {
        message: `${type} ${doc._id} reaches the disk`,
      })
      .toBeTruthy();
    const stored = readRawDocs(dataPath, type).find((candidate) => candidate._id === doc._id);
    const [inApp] = await loggedOutUser.pageManager.findDocs(`insomnia.${type}.db`, { _id: doc._id });
    for (const field of encrypted) {
      expect(valueAt(stored, field), `${type} ${doc._id}: ${field} is encrypted`).toMatch(ENCRYPTED_VALUE);
      expect(valueAt(inApp, field), `${type} ${doc._id}: ${field} in the app`).toBe(valueAt(doc, field));
    }
  }

  const text = readRawDbText(dataPath);
  for (const value of secrets) {
    expect(text, `no plaintext "${value}" in any .db file`).not.toContain(value);
  }
});
