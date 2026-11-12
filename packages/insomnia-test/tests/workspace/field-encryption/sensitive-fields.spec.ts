import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { createDoc, ENCRYPTED_VALUE, readRawDbText, readRawDocs, updateDoc } from "@package/misc/db";
import type { UserSession } from "@package/misc/fixtures";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

/**
 * One document to seed through the app's database layer, plus what the field
 * encryption must (and must not) do to it. Paths are the dotted form of the
 * design doc's field table; `cookies[].value` addresses every array element.
 */
export interface Scenario {
  /** The model type, e.g. `Request`. */
  type: string;
  doc: Record<string, any>;
  /** Paths that must be `enc:insomnia:v1:` on disk and the original value in the app. */
  encrypted: string[];
  /** Paths that must stay readable on disk (identifiers, short-lived values, names). */
  plain?: string[];
  /** Update the existing document `doc._id` instead of creating one. */
  update?: boolean;
}

/** Every value at `path`; `[]` fans out over array elements. */
export function valuesAt(doc: any, path: string): unknown[] {
  let current: unknown[] = [doc];
  for (const segment of path.split(".")) {
    const isArray = segment.endsWith("[]");
    const key = isArray ? segment.slice(0, -2) : segment;
    current = current
      .map((value) => (value as any)?.[key])
      .flatMap((value) => (isArray ? (Array.isArray(value) ? value : []) : [value]));
  }
  return current;
}

const nonEmpty = (values: unknown[]): string[] =>
  values.filter((v): v is string => typeof v === "string" && v !== "");

/** The plaintext of every encrypted field the scenarios seed. */
export function secretsOf(scenarios: Scenario[]): string[] {
  return scenarios.flatMap((s) => s.encrypted.flatMap((path) => nonEmpty(valuesAt(s.doc, path))));
}

/**
 * Creates `scenarios`, then proves — before and after two app restarts — that
 * the sensitive paths are ciphertext on disk, nothing secret is left in any
 * `.db` file, the non-sensitive paths are untouched, and the app still reads
 * every original value.
 */
export async function expectScenariosEncrypted(
  user: UserSession,
  dataPath: string,
  scenarios: Scenario[],
  seed: (scenarios: Scenario[]) => Promise<void>,
): Promise<void> {
  await seed(scenarios);
  const secrets = secretsOf(scenarios);
  expect(secrets.length, "scenarios must seed at least one secret").toBeGreaterThan(0);

  const expectOnDisk = async () => {
    for (const scenario of scenarios) {
      await expect
        .poll(
          () => readRawDocs(dataPath, scenario.type).find((d) => d._id === scenario.doc._id),
          { message: `${scenario.type} ${scenario.doc._id} reaches the disk` },
        )
        .toBeTruthy();
      const raw = readRawDocs(dataPath, scenario.type).find((d) => d._id === scenario.doc._id);
      for (const path of scenario.encrypted) {
        const expected = nonEmpty(valuesAt(scenario.doc, path));
        const onDisk = valuesAt(raw, path).filter((v) => v !== "" && v !== undefined);
        expect(onDisk, `${scenario.type} ${scenario.doc._id}: ${path} exists`).toHaveLength(expected.length);
        for (const value of onDisk) {
          expect(value, `${scenario.type} ${scenario.doc._id}: ${path} is encrypted`).toMatch(ENCRYPTED_VALUE);
        }
      }
      for (const path of scenario.plain ?? []) {
        expect(valuesAt(raw, path), `${scenario.type} ${scenario.doc._id}: ${path} stays plaintext`).toEqual(
          valuesAt(scenario.doc, path),
        );
      }
    }
    const text = readRawDbText(dataPath);
    for (const secret of secrets) {
      expect(text, `no plaintext "${secret}" in any .db file`).not.toContain(secret);
    }
  };

  const expectInApp = async () => {
    for (const scenario of scenarios) {
      const [doc] = await user.pageManager.findDocs(`insomnia.${scenario.type}.db`, { _id: scenario.doc._id });
      expect(doc, `${scenario.type} ${scenario.doc._id} is readable`).toBeTruthy();
      for (const path of [...scenario.encrypted, ...(scenario.plain ?? [])]) {
        expect(valuesAt(doc, path), `${scenario.type} ${scenario.doc._id}: ${path} in the app`).toEqual(
          valuesAt(scenario.doc, path),
        );
      }
    }
  };

  await expectOnDisk();
  await expectInApp();
  for (const restart of [1, 2]) {
    await user.flowManager.appFlow.restart();
    await expectOnDisk();
    await expectInApp();
    await expect(
      user.pageManager.window
        .getByRole("dialog")
        .filter({ hasText: /could not be decrypted|encryption key is not available/ }),
      `no decryption dialog after restart #${restart}`,
    ).toHaveCount(0);
  }
}

/** A distinctive, greppable secret: unique per document and field. */
const secret = (scope: string, field: string): string => `secret-${scope}-${field}-${faker.string.alphanumeric(10)}`;

async function createWorkspace(user: UserSession): Promise<string> {
  const { workspaceFlow } = user.flowManager;
  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));
  const [workspace] = await user.pageManager.findDocs("insomnia.Workspace.db", { name: collection.name });
  return workspace._id;
}

async function seed(user: UserSession, scenarios: Scenario[]): Promise<void> {
  const page = user.pageManager.window;
  for (const scenario of scenarios) {
    await (scenario.update ? updateDoc(page, scenario.type, scenario.doc._id, scenario.doc) : createDoc(page, scenario.type, scenario.doc));
  }
}

// The union of every authentication type's fields (design doc: "Authentication field list").
// Identifier-like and short-lived values (clientId, tokenKey, Hawk id, ASAP keyId, OAuth2 code/state,
// OAuth1 verifier) must stay plaintext. API Key's `key` is encrypted too: names are merged across the union.
function authenticationScenarios(parentId: string): Scenario[] {
  const request = (id: string, authentication: Record<string, any>, encrypted: string[], plain: string[]): Scenario => ({
    type: "Request",
    doc: { _id: `req_e2e_${id}`, parentId, name: `auth ${id}`, url: "https://example.com", authentication },
    encrypted: encrypted.map((f) => `authentication.${f}`),
    plain: ["name", "url", ...plain.map((f) => `authentication.${f}`), "authentication.type"],
  });
  return [
    request(
      "basic",
      { type: "basic", username: "basic-user", password: secret("basic", "password") },
      ["password"],
      ["username"],
    ),
    request(
      "digest",
      { type: "digest", username: "digest-user", password: secret("digest", "password") },
      ["password"],
      ["username"],
    ),
    request(
      "ntlm",
      { type: "ntlm", username: "ntlm-user", password: secret("ntlm", "password") },
      ["password"],
      ["username"],
    ),
    request(
      "bearer",
      { type: "bearer", prefix: "Bearer", token: secret("bearer", "token") },
      ["token"],
      ["prefix"],
    ),
    request(
      "singletoken",
      { type: "singleToken", token: secret("singletoken", "token") },
      ["token"],
      [],
    ),
    request(
      "apikey",
      { type: "apikey", key: secret("apikey", "key"), value: secret("apikey", "value"), addTo: "header" },
      ["key", "value"],
      ["addTo"],
    ),
    request(
      "oauth2",
      {
        type: "oauth2",
        grantType: "authorization_code",
        clientId: "oauth2-client-id",
        clientSecret: secret("oauth2", "clientSecret"),
        username: "oauth2-user",
        password: secret("oauth2", "password"),
        accessToken: secret("oauth2", "accessToken"),
        refreshToken: secret("oauth2", "refreshToken"),
        code: "oauth2-code",
        state: "oauth2-state",
      },
      ["clientSecret", "password", "accessToken", "refreshToken"],
      ["clientId", "username", "code", "state", "grantType"],
    ),
    request(
      "hawk",
      { type: "hawk", id: "hawk-id", key: secret("hawk", "key"), algorithm: "sha256" },
      ["key"],
      ["id", "algorithm"],
    ),
    request(
      "oauth1",
      {
        type: "oauth1",
        consumerKey: "oauth1-consumer-key",
        consumerSecret: secret("oauth1", "consumerSecret"),
        tokenKey: "oauth1-token-key",
        tokenSecret: secret("oauth1", "tokenSecret"),
        privateKey: secret("oauth1", "privateKey"),
        verifier: "oauth1-verifier",
      },
      ["consumerSecret", "tokenSecret", "privateKey"],
      ["consumerKey", "tokenKey", "verifier"],
    ),
    request(
      "iam",
      {
        type: "iam",
        accessKeyId: secret("iam", "accessKeyId"),
        secretAccessKey: secret("iam", "secretAccessKey"),
        sessionToken: secret("iam", "sessionToken"),
        region: "us-east-1",
        service: "execute-api",
      },
      ["accessKeyId", "secretAccessKey", "sessionToken"],
      ["region", "service"],
    ),
    request(
      "asap",
      {
        type: "asap",
        issuer: "asap-issuer",
        audience: "asap-audience",
        keyId: "asap-key-id",
        privateKey: secret("asap", "privateKey"),
      },
      ["privateKey"],
      ["issuer", "audience", "keyId"],
    ),
  ];
}

test("Request: every authentication type's secrets are encrypted, identifiers stay plaintext", async ({
  user,
  dataPath,
}) => {
  const workspaceId = await createWorkspace(user);
  await expectScenariosEncrypted(user, dataPath, authenticationScenarios(workspaceId), (s) => seed(user, s));
});

test("Workspace, folder, WebSocket, Socket.IO and MCP requests: shared authentication fields are encrypted", async ({
  user,
  dataPath,
}) => {
  const workspaceId = await createWorkspace(user);
  const auth = (scope: string) => ({
    type: "basic",
    username: `${scope}-user`,
    password: secret(scope, "password"),
  });
  const shared = (scope: string) => ({
    encrypted: ["authentication.password"],
    plain: ["authentication.username", "authentication.type"],
  });
  const scenarios: Scenario[] = [
    { type: "Workspace", update: true, doc: { _id: workspaceId, authentication: auth("workspace") }, ...shared("workspace") },
    {
      type: "RequestGroup",
      doc: { _id: "fld_e2e_auth", parentId: workspaceId, name: "folder", authentication: auth("folder") },
      ...shared("folder"),
    },
    {
      type: "WebSocketRequest",
      doc: { _id: "ws-req_e2e_auth", parentId: workspaceId, name: "ws", url: "ws://localhost", authentication: auth("websocket") },
      ...shared("websocket"),
    },
    {
      type: "SocketIORequest",
      doc: { _id: "socketio-req_e2e_auth", parentId: workspaceId, name: "sio", url: "http://localhost", authentication: auth("socketio") },
      ...shared("socketio"),
    },
    {
      type: "McpRequest",
      doc: { _id: "mcp-req_e2e_auth", parentId: workspaceId, name: "mcp", url: "http://localhost", authentication: auth("mcp") },
      ...shared("mcp"),
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("ClientCertificate: passphrase, cert, key and pfx are encrypted", async ({ user, dataPath }) => {
  const workspaceId = await createWorkspace(user);
  const scenarios: Scenario[] = [
    {
      type: "ClientCertificate",
      doc: {
        _id: "crt_e2e_pem",
        parentId: workspaceId,
        host: "pem.example.com",
        passphrase: secret("cert-pem", "passphrase"),
        cert: `-----BEGIN CERTIFICATE-----\n${secret("cert-pem", "cert")}\n-----END CERTIFICATE-----`,
        key: `-----BEGIN PRIVATE KEY-----\n${secret("cert-pem", "key")}\n-----END PRIVATE KEY-----`,
        pfx: null,
        disabled: false,
        isPrivate: false,
      },
      encrypted: ["passphrase", "cert", "key"],
      plain: ["host"],
    },
    {
      type: "ClientCertificate",
      doc: {
        _id: "crt_e2e_pfx",
        parentId: workspaceId,
        host: "pfx.example.com",
        passphrase: secret("cert-pfx", "passphrase"),
        cert: null,
        key: null,
        pfx: secret("cert-pfx", "pfx"),
        disabled: false,
        isPrivate: false,
      },
      encrypted: ["passphrase", "pfx"],
      plain: ["host"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("GitCredentials: legacy top-level and provider credentials are encrypted", async ({ user, dataPath }) => {
  const scenarios: Scenario[] = [
    {
      // Legacy shape: token / refreshToken live at the top level
      type: "GitCredentials",
      doc: {
        _id: "git_creds_e2e_legacy",
        name: "legacy",
        provider: "github",
        token: secret("git-legacy", "token"),
        refreshToken: secret("git-legacy", "refreshToken"),
        author: { name: "Legacy", email: "legacy@example.com" },
      },
      encrypted: ["token", "refreshToken"],
      plain: ["name", "provider", "author.email"],
    },
    {
      type: "GitCredentials",
      doc: {
        _id: "git_creds_e2e_github",
        name: "github",
        provider: "github",
        credentials: {
          token: secret("git-github", "token"),
          refreshToken: secret("git-github", "refreshToken"),
          scopes: ["repo"],
        },
        author: { name: "GitHub", email: "github@example.com" },
      },
      encrypted: ["credentials.token", "credentials.refreshToken"],
      plain: ["name", "provider", "credentials.scopes", "author.email"],
    },
    {
      // Custom (username + access token) credential keeps its secret in `credentials.password`
      type: "GitCredentials",
      doc: {
        _id: "git_creds_e2e_custom",
        name: "custom",
        provider: "custom",
        credentials: { username: "custom-user", password: secret("git-custom", "password") },
        author: { name: "Custom", email: "custom@example.com" },
      },
      encrypted: ["credentials.password"],
      plain: ["name", "provider", "credentials.username", "author.email"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("CloudCredential: AWS, HashiCorp and Azure secrets are encrypted", async ({ user, dataPath }) => {
  const scenarios: Scenario[] = [
    {
      type: "CloudCredential",
      doc: {
        _id: "cloudCred_e2e_aws",
        name: "aws",
        provider: "aws",
        credentials: {
          type: "temporary",
          accessKeyId: secret("aws", "accessKeyId"),
          secretAccessKey: secret("aws", "secretAccessKey"),
          sessionToken: secret("aws", "sessionToken"),
          region: "us-east-1",
        },
      },
      encrypted: ["credentials.accessKeyId", "credentials.secretAccessKey", "credentials.sessionToken"],
      plain: ["name", "provider", "credentials.type", "credentials.region"],
    },
    {
      type: "CloudCredential",
      doc: {
        _id: "cloudCred_e2e_hcp",
        name: "hcp",
        provider: "hashicorp",
        credentials: {
          type: "cloud",
          client_id: "hcp-client-id",
          client_secret: secret("hcp", "client_secret"),
          access_token: secret("hcp", "access_token"),
        },
      },
      encrypted: ["credentials.client_secret", "credentials.access_token"],
      plain: ["name", "provider", "credentials.client_id"],
    },
    {
      type: "CloudCredential",
      doc: {
        _id: "cloudCred_e2e_vault_approle",
        name: "vault approle",
        provider: "hashicorp",
        credentials: {
          type: "onPrem",
          authMethod: "appRole",
          role_id: "vault-role-id",
          secret_id: secret("vault-approle", "secret_id"),
          serverAddress: "https://vault.example.com",
        },
      },
      encrypted: ["credentials.secret_id"],
      plain: ["name", "credentials.role_id", "credentials.serverAddress"],
    },
    {
      type: "CloudCredential",
      doc: {
        _id: "cloudCred_e2e_azure",
        name: "azure",
        provider: "azure",
        credentials: {
          uniqueId: "azure-unique-id",
          account: { username: "azure-user" },
          accessToken: secret("azure", "accessToken"),
        },
      },
      encrypted: ["credentials.accessToken"],
      plain: ["name", "credentials.uniqueId"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("OAuth2Token: access, refresh and identity tokens are encrypted", async ({ user, dataPath }) => {
  const workspaceId = await createWorkspace(user);
  const scenarios: Scenario[] = [
    {
      type: "OAuth2Token",
      doc: {
        _id: "oa2_e2e_token",
        parentId: workspaceId,
        accessToken: secret("oa2", "accessToken"),
        refreshToken: secret("oa2", "refreshToken"),
        identityToken: secret("oa2", "identityToken"),
        expiresAt: 4_102_444_800_000,
      },
      encrypted: ["accessToken", "refreshToken", "identityToken"],
      plain: ["expiresAt"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("CookieJar: every cookie's value is encrypted, its key and domain stay plaintext", async ({ user, dataPath }) => {
  const workspaceId = await createWorkspace(user);
  // A workspace owns exactly one Cookie Jar (auto-created), so fill the existing one instead of adding a second
  const [jar] = await user.pageManager.findDocs("insomnia.CookieJar.db", { parentId: workspaceId });
  const scenarios: Scenario[] = [
    {
      type: "CookieJar",
      update: true,
      doc: {
        _id: jar._id,
        cookies: [
          { id: "c1", key: "session", value: secret("cookie", "session"), domain: "example.com", path: "/" },
          { id: "c2", key: "csrf", value: secret("cookie", "csrf"), domain: "example.com", path: "/" },
          { id: "c3", key: "other", value: secret("cookie", "other"), domain: "other.example.com", path: "/api" },
        ],
      },
      encrypted: ["cookies[].value"],
      plain: ["cookies[].key", "cookies[].domain", "cookies[].path"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("GrpcRequest: the reflection API key is encrypted", async ({ user, dataPath }) => {
  const workspaceId = await createWorkspace(user);
  const scenarios: Scenario[] = [
    {
      type: "GrpcRequest",
      doc: {
        _id: "greq_e2e_reflection",
        parentId: workspaceId,
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
      plain: ["name", "url", "reflectionApi.url", "reflectionApi.module"],
    },
  ];
  await expectScenariosEncrypted(user, dataPath, scenarios, (s) => seed(user, s));
});

test("Environment: confidential variable values stay plaintext (documented non-goal)", async ({ user, dataPath }) => {
  const workspaceId = await createWorkspace(user);
  const value = `plain-confidential-${faker.string.alphanumeric(10)}`;
  const doc = {
    _id: "env_e2e_confidential",
    parentId: workspaceId,
    name: "confidential",
    kvPairData: [{ id: "kv1", name: "apiKey", value, type: "str", enabled: true, isConfidential: true }],
  };
  await seed(user, [{ type: "Environment", doc, encrypted: [] }]);
  await expect
    .poll(() => readRawDocs(dataPath, "Environment").find((d) => d._id === doc._id)?.kvPairData?.[0]?.value)
    .toBe(value);
});
