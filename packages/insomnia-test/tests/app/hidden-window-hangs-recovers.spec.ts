import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { DEFAULT_TIMEOUT, HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify the hidden script window automatically restarts after an infinite-loop script hangs it, and a later request still succeeds", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
  const { httpRequestPage, responsePage } = user.pageManager;

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
    preRequestScript: "while (true) {}",
  });
  const laterRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await preferencesFlow.set({ timeout: 5000 });

  await httpRequestFlow.get(request.name);
  await httpRequestPage.send();
  let timeoutMessageVisible = false;
  await expect
    .poll(
      async () =>
        (timeoutMessageVisible = await responsePage.hasMessage(
          "Executing script timeout",
        )),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);

  const laterResponse = await httpRequestFlow.send(laterRequest);

  expect(timeoutMessageVisible).toBe(true);
  expect(laterResponse.statusBar.code).toBe(200);
});
