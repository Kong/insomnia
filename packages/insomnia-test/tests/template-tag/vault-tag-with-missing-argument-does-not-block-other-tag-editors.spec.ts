import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Clicking a Vault Tag With a Missing Argument Does Not Stop Other Template Tags From Opening Their Editor", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, templateTagFlow } = user.flowManager;
  const { templateTagPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const hashTag = "{% hash 'md5', 'hex', 'hello' %}";
  const vaultTag = "{% vault 'hashicorp' %}";
  const hashRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/${hashTag}`,
  });
  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/${vaultTag}`,
  });

  await templateTagPage.openTagByTemplate(vaultTag);
  await templateTagPage.done();
  await httpRequestFlow.get(hashRequest);
  const hashResult = await templateTagFlow.get(hashTag);

  expect(hashResult.functionName).toBe("hash");
  expect(hashResult.preview).toBe("5d41402abc4b2a76b9719d911017c592");
});
