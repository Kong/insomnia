import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT,expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const LONG_DELAY_AFTER_RESPONSE_SCRIPT = `
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function printAfterDelay() {
    await delay(3000);
}
await printAfterDelay();
`;

test("Verify closing the hidden script-execution window mid-timeout surfaces the timeout and the app recovers for a later request", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, appFlow, preferencesFlow } =
    user.flowManager;
  const { httpRequestPage, responsePage } = user.pageManager;

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
    afterResponseScript: LONG_DELAY_AFTER_RESPONSE_SCRIPT,
  });
  const laterRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await preferencesFlow.set({ timeout: 1000 });

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

  await appFlow.closeHiddenScriptWindow();

  await preferencesFlow.set({ timeout: 6000 });
  const laterResponse = await httpRequestFlow.send(laterRequest);

  expect(timeoutMessageVisible).toBe(true);
  expect(laterResponse.statusCode).toBe(200);
});
