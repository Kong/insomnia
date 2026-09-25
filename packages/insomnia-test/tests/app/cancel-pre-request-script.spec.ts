import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { SendButtonState } from "../../enums/send-button-state";
import { DEFAULT_TIMEOUT,expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const LONG_DELAY_PRE_REQUEST_SCRIPT = `
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function printAfterDelay() {
    await delay(3000);
}
await printAfterDelay();
`;

test("Verify cancelling a long-running pre-request script shows a cancellation message and a later request still succeeds", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
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
    preRequestScript: LONG_DELAY_PRE_REQUEST_SCRIPT,
  });
  const laterRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await httpRequestFlow.get(request.name);
  await httpRequestPage.send();
  await expect
    .poll(() => responsePage.getSendButtonState(), { timeout: DEFAULT_TIMEOUT })
    .toBe(SendButtonState.Sending);
  await responsePage.cancelRequest();
  let cancelledMessageVisible = false;
  await expect
    .poll(
      async () =>
        (cancelledMessageVisible = await responsePage.hasMessage(
          "Request was cancelled",
        )),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);

  const laterResponse = await httpRequestFlow.send(laterRequest);

  expect(cancelledMessageVisible).toBe(true);
  expect(laterResponse.statusCode).toBe(200);
});
