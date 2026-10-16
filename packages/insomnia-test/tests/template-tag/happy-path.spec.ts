import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Inserting a Template Tag and Reading its Live Preview", async ({
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

  const uuidTag = "{% uuid 'v4' %}";
  const base64Tag = "{% base64 'encode', 'normal', 'hello' %}";
  const nowTag = "{% now 'unix' %}";
  const fakerTag = "{% faker 'randomFirstName' %}";
  const jsonpathTag = "{% jsonpath '{\"a\":{\"b\":42}}', '$.a.b' %}";
  const osTag = "{% os 'platform' %}";
  const requestTag = "{% request 'name' %}";

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${uuidTag}${base64Tag}${nowTag}${fakerTag}${jsonpathTag}${osTag}${requestTag}`,
  });

  const uuidResult = await templateTagFlow.get(uuidTag);
  const base64Result = await templateTagFlow.get(base64Tag);
  const nowResult = await templateTagFlow.get(nowTag);
  const fakerResult = await templateTagFlow.get(fakerTag);
  const jsonpathResult = await templateTagFlow.get(jsonpathTag);
  const osResult = await templateTagFlow.get(osTag);
  const requestResult = await templateTagFlow.get(requestTag);

  expect(uuidResult.preview).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(base64Result.preview).toBe("aGVsbG8=");
  expect(nowResult.preview).toMatch(/^\d+$/);
  expect(fakerResult.preview).toMatch(/^[A-Za-z'-]+$/);
  expect(jsonpathResult.preview).toBe("42");
  expect(osResult.preview).toBe(process.platform);
  expect(requestResult.preview).toBe(request!.name);
});
