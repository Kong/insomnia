import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { RequestState } from "../../enums/request-state";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Cancelling an In-Flight HTTP Request Shows a Cancellation Message and a Later Request Still Succeeds", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;
  const { httpRequestPage, responsePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const slowRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    headers: [{ name: "x-reply-delay-ms", value: "10000" }],
  });
  const laterRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  });

  await httpRequestFlow.get(slowRequest.name);
  await httpRequestPage.send();
  await expect
    .poll(() => responsePage.getRequestState(), { timeout: DEFAULT_TIMEOUT })
    .toBe(RequestState.Sending);
  await responsePage.cancelRequest();
  await expect
    .poll(() => responsePage.hasMessage("Request was cancelled"), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  const requestStateAfterCancel = await responsePage.getRequestState();
  const cancelledResponse = await responsePage.get();

  const laterResponse = await httpRequestFlow.send(laterRequest);

  expect(requestStateAfterCancel).toBe(RequestState.Idle);
  expect(cancelledResponse.statusCode).toBeUndefined();
  expect(laterResponse.statusCode).toBe(200);
});
