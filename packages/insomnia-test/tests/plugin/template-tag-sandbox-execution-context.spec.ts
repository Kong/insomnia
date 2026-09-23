import * as fs from "node:fs";
import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify a plugin template tag runs in the QuickJS sandbox when enabled and in the main process when disabled", async ({
  user,
}) => {
  const { appFlow, workspaceFlow, httpRequestFlow, preferencesFlow } =
    user.flowManager;
  const { preferencesPage } = user.pageManager;

  const pluginName = faker.lorem.slug(2);
  const tagName = `probeCtx${faker.string.alphanumeric(6)}`;
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
      displayName: 'Probe Ctx',
      run(context) {
        return (typeof process === 'undefined' || typeof process.binding === 'undefined')
          ? 'sandbox'
          : 'main-process';
      },
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
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    headers: [{ name: "X-Sandbox-Ctx", value: `{% ${tagName} %}` }],
  });

  await preferencesFlow.set({ templateTagSandboxEnabled: false });
  const responseWithSandboxDisabled = await httpRequestFlow.send(request!);

  await preferencesFlow.set({ templateTagSandboxEnabled: true });
  const responseWithSandboxEnabled = await httpRequestFlow.send(request!);

  expect(
    (responseWithSandboxDisabled.body as any)?.headers?.["x-sandbox-ctx"],
  ).toBe("main-process");
  expect(
    (responseWithSandboxEnabled.body as any)?.headers?.["x-sandbox-ctx"],
  ).toBe("sandbox");
});
