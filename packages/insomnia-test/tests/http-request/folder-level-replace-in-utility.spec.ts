import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify a folder-level script wrapping insomnia.variables.replaceIn resolves synchronously for a downstream request consuming it without await", async ({
  user,
}) => {
  const { folderFlow, httpRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );

  await folderFlow.setScripts(folder, {
    preRequest: `
      insomnia.globals.set('firstname', insomnia.variables.replaceIn('{{ $randomFirstName }}'));
    `,
  });

  const request = await httpRequestFlow.create(folder, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      const firstname = insomnia.globals.get('firstname');
      console.log(typeof firstname, firstname);
    `,
  });
  const response = await httpRequestFlow.send(request);

  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toMatch(/log: string \S+/);
  const consoleText = await response.console?.();
  expect(consoleText).not.toContain("Promise");
  expect(consoleText).not.toContain("undefined");
});
