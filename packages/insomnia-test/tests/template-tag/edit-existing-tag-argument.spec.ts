import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Switching an Existing Tag's Argument Updates its Live Preview", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, templateTagFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const hashTag = "{% hash 'md5', 'hex', 'hello' %}";
  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/${hashTag}`,
  });

  const before = await templateTagFlow.get(hashTag);
  const after = await templateTagFlow.edit(hashTag, {
    functionName: "hash",
    algorithm: "sha256",
    digestEncoding: "hex",
    input: "hello",
    preview: "",
  });

  expect(before.functionName).toBe("hash");
  expect(before.algorithm).toBe("md5");
  expect(before.preview).toBe("5d41402abc4b2a76b9719d911017c592");
  expect(after.algorithm).toBe("sha256");
  expect(after.preview).toBe(
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});
