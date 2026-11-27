import fs from "node:fs";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { UpgradePhase } from "@package/enums/upgrade-phase";
import { HTTP_SERVER, MOCK_API_SERVER } from "@package/misc/constants";
import { ENCRYPTED_VALUE, readRawDbText, readRawDocs } from "@package/misc/db";
import { keyFilePath } from "@package/misc/field-encryption-fixtures";
import { test as base } from "@package/misc/fixtures";
import type { UpgradeFixtures } from "@package/misc/upgrade-fixture";
import { upgradeFixtures, upgradePhase } from "@package/misc/upgrade-fixture";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

const PROJECT_NAME = "Upgrade project";
const COLLECTION_NAME = "Upgrade collection";
const BEARER_REQUEST = "Upgrade bearer request";
const BASIC_REQUEST = "Upgrade basic request";
const BEARER_TOKEN = "bearer-token-written-by-the-previous-release";
const BASIC_PASSWORD = "pass";
const COOKIE_VALUE = "cookie-value-written-by-the-previous-release";
const COOKIE_DOMAIN = "example.com";

// The e2e framework drives the sidebar through attributes (data-node-type, data-parent-id, ...) that no release has
// without also having field encryption: core@13.4.0 predates them, core@13.5.0-beta.0 already encrypts. So the "previous
// release" is the commit that added the framework (insomnia-test #10594), the last one that stores secrets as plaintext.
const PREVIOUS_RELEASE = "54e46851ff4a4ca8a357e351ef8bed713ceda42a";

const STRUCTURE_MODELS = ["Project", "Workspace", "Request"];

let before: Record<string, any[]> = {};

const test = base.extend<UpgradeFixtures>(upgradeFixtures).extend({
  dataPath: async ({ dataPath }, use, testInfo) => {
    if (testInfo.tags.includes(UpgradePhase.After)) {
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

test(
  "A user of the previous release saves a bearer token, a Basic password and a cookie",
  upgradePhase(UpgradePhase.Before),
  async ({ user, dataPath }) => {
    const { workspaceFlow, httpRequestFlow, cookieFlow, preferencesFlow } = user.flowManager;
    await preferencesFlow.set({ sidebarFocusForCollections: false });
    const project = await workspaceFlow.createProject(new Project(PROJECT_NAME, ProjectType.Local));
    const collection = await workspaceFlow.createCollection(project, new Collection(COLLECTION_NAME));
    await httpRequestFlow.create(
      collection,
      {
        name: BEARER_REQUEST,
        method: HttpMethod.Get,
        url: `${HTTP_SERVER}/get`,
        authentication: { type: "bearer", token: BEARER_TOKEN },
      },
    );
    await httpRequestFlow.create(
      collection,
      {
        name: BASIC_REQUEST,
        method: HttpMethod.Get,
        url: `${MOCK_API_SERVER}/auth/basic`,
        authentication: { type: "basic", username: "user", password: BASIC_PASSWORD },
      },
    );
    await cookieFlow.link(collection, [{ key: "session", value: COOKIE_VALUE, domain: COOKIE_DOMAIN, path: "/" }]);

    await expect.poll(() => readRawDbText(dataPath)).toContain(BEARER_TOKEN);
    expect(readRawDbText(dataPath)).toContain(COOKIE_VALUE);
  },
);

test(
  "Data of the previous release is encrypted when the current release first opens it, and the user loses nothing",
  upgradePhase(UpgradePhase.After),
  async ({ user, dataPath }) => {
    const { appFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

    expect(fs.existsSync(keyFilePath(dataPath))).toBe(true);
    await appFlow.expectNoEncryptionUi();

    const expectMigrated = async () => {
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
      for (const secret of [BEARER_TOKEN, `"password":"${BASIC_PASSWORD}"`, COOKIE_VALUE]) {
        expect(text, `no plaintext ${secret} on disk`).not.toContain(secret);
      }

      const [bearer] = await user.pageManager.findDocs("insomnia.Request.db", { name: BEARER_REQUEST });
      expect(bearer.authentication.token).toBe(BEARER_TOKEN);
      const [appBasic] = await user.pageManager.findDocs("insomnia.Request.db", { name: BASIC_REQUEST });
      expect(appBasic.authentication.password).toBe(BASIC_PASSWORD);
      const appCookies = (await user.pageManager.findDocs("insomnia.CookieJar.db")).flatMap((jar) => jar.cookies ?? []);
      expect(appCookies.find((c) => c.key === "session")?.value).toBe(COOKIE_VALUE);
    };

    for (const model of STRUCTURE_MODELS) {
      const after = await user.pageManager.findDocs(`insomnia.${model}.db`);
      for (const doc of before[model]) {
        const now = after.find((d) => d._id === doc._id);
        expect(now, `${model} ${doc._id} is still there`).toBeTruthy();
        expect(now.name, `${model} ${doc._id} keeps its name`).toBe(doc.name);
      }
    }

    await expectMigrated();

    await workspaceFlow.expandCollection(PROJECT_NAME, COLLECTION_NAME);
    const response = await httpRequestFlow.send(
      { name: BASIC_REQUEST, method: HttpMethod.Get, url: `${MOCK_API_SERVER}/auth/basic` },
    );
    expect(response.statusBar.code).toBe(200);

    await appFlow.restart();
    await expectMigrated();
    await appFlow.expectNoIssueDialog("after a restart");
  },
);
