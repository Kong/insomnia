import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Clicking Template Tags With Missing Arguments Does Not Stop Other Template Tags From Opening Their Editor", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, templateTagFlow } = user.flowManager;
  const { templateTagPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const hashTag = "{% hash 'md5', 'hex', 'hello' %}";
  const incompleteTags = [
    "{% vault 'hashicorp' %}",
    "{% file %}",
    "{% hash %}",
    "{% base64 %}",
    "{% response %}",
    "{% jsonpath %}",
    "{% cookie %}",
    "{% request %}",
  ];
  const hashRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/${hashTag}`,
  });
  const incompleteRequests = [];
  for (const tag of incompleteTags) {
    incompleteRequests.push(
      await httpRequestFlow.create(collection, {
        name: faker.string.alphanumeric(10),
        method: HttpMethod.Get,
        url: `${HTTP_SERVER}/${tag}`,
      }),
    );
  }

  for (const [index, tag] of incompleteTags.entries()) {
    await httpRequestFlow.get(incompleteRequests[index]);
    await templateTagPage.openTagByTemplate(tag);
    await templateTagPage.done();
  }
  await httpRequestFlow.get(hashRequest);
  const hashResult = await templateTagFlow.get(hashTag);

  expect(hashResult.functionName).toBe("hash");
  expect(hashResult.preview).toBe("5d41402abc4b2a76b9719d911017c592");
});
