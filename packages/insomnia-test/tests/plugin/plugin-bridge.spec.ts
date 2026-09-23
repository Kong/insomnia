import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify the plugin bridge executes request actions, surfaces thrown errors, and handles concurrent calls without cross-talk", async ({
  user,
}) => {
  const { appFlow, workspaceFlow, httpRequestFlow } = user.flowManager;
  const { preferencesPage } = user.pageManager;

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
  await preferencesPage.reloadPlugins();

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  } as HttpRequest);

  const metricsBefore = await preferencesPage.getPluginBridgeMetrics();
  const concurrentResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      preferencesPage.getRegisteredTemplateTagNames(),
    ),
  );
  const metricsAfter = await preferencesPage.getPluginBridgeMetrics();

  let actionError: unknown;
  try {
    await preferencesPage.executeRequestAction(actionLabel, request.id!);
  } catch (e) {
    actionError = e;
  }

  const metricsAfterThrow = await preferencesPage.getPluginBridgeMetrics();

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
