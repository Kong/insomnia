import { faker } from "@faker-js/faker";
import { ContentType } from "@package/enums/content-type";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify a prompt Tag Caches its Value Under the Storage Key Until it is Cleared", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, templateTagFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const label = faker.string.alpha(12);
  const storageKey = faker.string.alphanumeric(10);
  const promptTag = `{% prompt '${label}', 'Enter secret', '', '${storageKey}', true, false %}`;
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body: { mimeType: ContentType.Plain, text: promptTag },
  });

  const firstValue = faker.string.alphanumeric(12);
  const secondValue = faker.string.alphanumeric(12);
  const previewBeforeSend = await templateTagFlow.get(promptTag);
  const first = await templateTagFlow.sendAnsweringPrompt(
    request,
    label,
    firstValue,
  );
  const cached = await httpRequestFlow.send(request);
  await templateTagFlow.clearCachedPrompt(promptTag);
  const second = await templateTagFlow.sendAnsweringPrompt(
    request,
    label,
    secondValue,
  );

  expect(previewBeforeSend.functionName).toBe("prompt");
  expect(first.promptInputType).toBe("password");
  expect(first.response.statusBar.code).toBe(200);
  expect(first.response.preview).toMatchObject({ data: firstValue });
  expect(cached.statusBar.code).toBe(200);
  expect(cached.preview).toMatchObject({ data: firstValue });
  expect(second.response.statusBar.code).toBe(200);
  expect(second.response.preview).toMatchObject({ data: secondValue });
});
