import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import type { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";

test("Verify the plugin bridge executes request actions, surfaces thrown errors, and handles concurrent calls without cross-talk", async ({
  user,
}) => {
  const { appFlow, workspaceFlow, httpRequestFlow } = user.flowManager;
  const { preferencesPage, preferencesPluginsPage } = user.pageManager;

  const pluginName = faker.lorem.slug(2);
  const tagName = `probeTag${faker.string.alphanumeric(6)}`;
  const actionLabel = `Probe Action ${faker.string.alphanumeric(6)}`;
  const dataPath = await appFlow.getDataPath();
  const pluginDir = path.join(dataPath, "plugins", `insomnia-plugin-${pluginName}`);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, "package.json"),
    JSON.stringify(
      {
        name: `insomnia-plugin-${pluginName}`,
        version: "0.0.1",
        private: true,
        insomnia: { name: pluginName, description: "" },
        main: "main.js",
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(pluginDir, "main.js"),
    `module.exports.templateTags = [{
      name: '${tagName}',
      displayName: 'Probe Tag',
      run() { return 'probe-value'; },
    }];
    module.exports.requestActions = [{
      label: '${actionLabel}',
      action() { throw new Error('probe action boom'); },
    }];`,
  );
  await preferencesPluginsPage.reloadPlugins();

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  } as HttpRequest);

  const metricsBefore = await preferencesPluginsPage.getPluginBridgeMetrics();
  const concurrentResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      preferencesPluginsPage.getRegisteredTemplateTagNames(),
    ),
  );
  const metricsAfter = await preferencesPluginsPage.getPluginBridgeMetrics();

  let actionError: unknown;
  try {
    await preferencesPluginsPage.executeRequestAction(actionLabel, request.id!);
  } catch (e) {
    actionError = e;
  }

  const metricsAfterThrow = await preferencesPluginsPage.getPluginBridgeMetrics();

  const tagNamesMethod = "getTemplateTags";
  const okBefore = metricsBefore.perMethod[tagNamesMethod]?.ok ?? 0;
  const errorBefore = metricsBefore.perMethod[tagNamesMethod]?.error ?? 0;
  const okAfter = metricsAfter.perMethod[tagNamesMethod]?.ok ?? 0;
  const errorAfter = metricsAfter.perMethod[tagNamesMethod]?.error ?? 0;

  expect(concurrentResults.every((names) => names.includes(tagName))).toBe(true);
  expect(okAfter - okBefore).toBe(20);
  expect(errorAfter - errorBefore).toBe(0);
  expect((actionError as Error)?.message).toMatch(/probe action boom/);
  expect(metricsAfterThrow.windowCrashes).toBe(0);
  expect(metricsAfterThrow.perMethod.executeAction?.error).toBeGreaterThan(0);
});
