import fs from "node:fs";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { UpgradePhase } from "@package/enums/upgrade-phase";
import { HTTP_SERVER } from "@package/misc/constants";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { keyFilePath } from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import type { UpgradeFixtures } from "@package/misc/upgrade-fixture";
import { upgradeFixtures, upgradePhase } from "@package/misc/upgrade-fixture";
import { Collection } from "@package/models/collection";
import { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

// The two phases run in different processes (the first one in the previous release), so what the first one creates
// has to be named by constants: nothing is shared between them but the data directory.
const PROJECT_NAME = "Upgrade project";
const COLLECTION_NAME = "Upgrade collection";
const BEARER_REQUEST = "Upgrade bearer request";
const BASIC_REQUEST = "Upgrade basic request";
const BEARER_TOKEN = "bearer-token-written-by-the-previous-release";
const BASIC_PASSWORD = "pass"; // what the mock server's /auth/basic accepts for the user "user"
const COOKIE_VALUE = "cookie-value-written-by-the-previous-release";
const COOKIE_DOMAIN = "example.com";

// The last release before the field encryption: it writes every secret as plaintext
const PREVIOUS_RELEASE = "core@13.3.0";

// Which models carry the user's own structure: projects, collections, requests
const STRUCTURE_MODELS = ["Project", "Workspace", "Request"];

// What the previous release left on disk, read before the current app is launched and touches it
let before: Record<string, any[]> = {};

const test = base.extend<UpgradeFixtures>(upgradeFixtures).extend({
  dataPath: async ({ dataPath }, use, testInfo) => {
    if (testInfo.tags.includes(UpgradePhase.After)) {
      // The previous release really did store the secrets as plaintext, otherwise nothing below proves a migration
      const text = readRawDbText(dataPath);
      expect(text, "the previous release stored the bearer token as plaintext").toContain(BEARER_TOKEN);
      expect(text, "the previous release stored the cookie value as plaintext").toContain(COOKIE_VALUE);
      expect(fs.existsSync(keyFilePath(dataPath)), "the previous release has no encryption key").toBe(false);
      before = Object.fromEntries(STRUCTURE_MODELS.map((model) => [model, readRawDocs(dataPath, model)]));
    }
    await use(dataPath);
  },
});
test.use({ appVersion: PREVIOUS_RELEASE });

// Runs in the previous release (see misc/upgrade-fixture.ts): what a user of it does, through its UI, to end up with
// secrets in the database. The next test upgrades the data this one leaves.
test(
  "A user of the previous release saves a bearer token, a Basic password and a cookie",
  upgradePhase(UpgradePhase.Before),
  async ({ user, dataPath }) => {
    const { workspaceFlow, httpRequestFlow, cookieFlow, preferencesFlow } = user.flowManager;
    // Shows the whole project tree, which the flows read, instead of only the collection that was opened last
    await preferencesFlow.set({ sidebarFocusForCollections: false });
    const project = await workspaceFlow.createProject(new Project(PROJECT_NAME, ProjectType.Local));
    const collection = await workspaceFlow.createCollection(project, new Collection(COLLECTION_NAME));
    await httpRequestFlow.create(
      collection,
      new HttpRequest({
        name: BEARER_REQUEST,
        method: HttpMethod.Get,
        url: `${HTTP_SERVER}/get`,
        authentication: { type: "bearer", token: BEARER_TOKEN },
      }),
    );
    await httpRequestFlow.create(
      collection,
      new HttpRequest({
        name: BASIC_REQUEST,
        method: HttpMethod.Get,
        url: `${HTTP_SERVER}/auth/basic`,
        authentication: { type: "basic", username: "user", password: BASIC_PASSWORD },
      }),
    );
    await cookieFlow.link(collection, [{ key: "session", value: COOKIE_VALUE, domain: COOKIE_DOMAIN, path: "/" }]);

    // Everything is on disk before this app is closed
    await expect.poll(() => readRawDbText(dataPath)).toContain(BEARER_TOKEN);
    expect(readRawDbText(dataPath)).toContain(COOKIE_VALUE);
  },
);

test(
  "Data of the previous release is encrypted when the current release first opens it, and the user loses nothing",
  upgradePhase(UpgradePhase.After),
  async ({ user, dataPath }) => {
    const { appFlow, fieldEncryptionFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

    // The key is created by this launch, and nothing tells the user about the migration
    expect(fs.existsSync(keyFilePath(dataPath))).toBe(true);
    await fieldEncryptionFlow.expectNoEncryptionUi();

    const expectMigrated = async () => {
      // The secrets are ciphertext on disk, and no plaintext of them is left in any .db file
      await expect
        .poll(() => readRawDocs(dataPath, "Request").find((doc) => doc.name === BEARER_REQUEST)?.authentication?.token)
        .toMatch(ENCRYPTED_VALUE);
      const basic = readRawDocs(dataPath, "Request").find((doc) => doc.name === BASIC_REQUEST);
      expect(basic.authentication.password).toMatch(ENCRYPTED_VALUE);
      const cookie = readRawDocs(dataPath, "CookieJar")
        .flatMap((jar) => jar.cookies ?? [])
        .find((c) => c.key === "session");
      expect(cookie.value).toMatch(ENCRYPTED_VALUE);
      expect(cookie).toMatchObject({ domain: COOKIE_DOMAIN, path: "/" });
      const text = readRawDbText(dataPath);
      // The Basic password is a short word the file contains elsewhere, so look for it as that field's value
      for (const secret of [BEARER_TOKEN, `"password":"${BASIC_PASSWORD}"`, COOKIE_VALUE]) {
        expect(text, `no plaintext ${secret} on disk`).not.toContain(secret);
      }

      // What the app holds is the plaintext again
      const [bearer] = await user.pageManager.findDocs("insomnia.Request.db", { name: BEARER_REQUEST });
      expect(bearer.authentication.token).toBe(BEARER_TOKEN);
      const [appBasic] = await user.pageManager.findDocs("insomnia.Request.db", { name: BASIC_REQUEST });
      expect(appBasic.authentication.password).toBe(BASIC_PASSWORD);
      const appCookies = (await user.pageManager.findDocs("insomnia.CookieJar.db")).flatMap((jar) => jar.cookies ?? []);
      expect(appCookies.find((c) => c.key === "session")?.value).toBe(COOKIE_VALUE);
    };

    // Every project, collection and request the user had is still there, with the same id and name
    for (const model of STRUCTURE_MODELS) {
      const after = await user.pageManager.findDocs(`insomnia.${model}.db`);
      for (const doc of before[model]) {
        const now = after.find((d) => d._id === doc._id);
        expect(now, `${model} ${doc._id} is still there`).toBeTruthy();
        expect(now.name, `${model} ${doc._id} keeps its name`).toBe(doc.name);
      }
    }

    await expectMigrated();

    // The request still sends its real credentials, not the stored ciphertext
    await workspaceFlow.expandCollection(PROJECT_NAME, COLLECTION_NAME);
    const response = await httpRequestFlow.send(
      new HttpRequest({ name: BASIC_REQUEST, method: HttpMethod.Get, url: `${HTTP_SERVER}/auth/basic` }),
    );
    expect(response.statusBar.code).toBe(200);

    // ... and it stays so after a restart
    await appFlow.restart();
    await expectMigrated();
    await fieldEncryptionFlow.expectNoIssueDialog("after a restart");
  },
);
